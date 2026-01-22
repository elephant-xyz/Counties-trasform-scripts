const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function toTitleCase(str) {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function parseCurrency(str) {
  if (!str) return null;
  const n = parseFloat(String(str).replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseIntSafe(str) {
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? null : n;
}

function validateEnum(value, allowedValues, className, propertyName) {
  if (value !== null && !allowedValues.includes(value)) {
    throw {
      type: "error",
      message: `Unknown enum value ${value}.`,
      path: `${className}.${propertyName}`,
    };
  }
  return value;
}

function isoDateFromMDY(mdy) {
  if (!mdy) return null;
  const m = mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    const m2 = mm.padStart(2, "0");
    const d2 = dd.padStart(2, "0");
    return `${yyyy}-${m2}-${d2}`;
  }
  const mYear = mdy.match(/^(\d{1,2})\/(\d{4})$/);
  if (mYear) {
    const [_, mm, yyyy] = mYear;
    const m2 = mm.padStart(2, "0");
    return `${yyyy}-${m2}-01`;
  }
  return null;
}

const ALLOWED_PROPERTY_TYPES = ["LandParcel", "Building", "Unit", "ManufacturedHome"];
const ALLOWED_BUILD_STATUS = ["VacantLand", "Improved", "UnderConstruction", null];
const ALLOWED_OWNERSHIP_ESTATE_TYPES = [
  "Condominium",
  "Cooperative",
  "LifeEstate",
  "Timeshare",
  "OtherEstate",
  "FeeSimple",
  "Leasehold",
  "RightOfWay",
  "NonWarrantableCondo",
  "SubsurfaceRights",
  null,
];
const ALLOWED_STRUCTURE_FORMS = [
    "SingleFamilyDetached",
    "SingleFamilySemiDetached",
    "TownhouseRowhouse",
    "Duplex",
    "Triplex",
    "Quadplex",
    "MultiFamily5Plus",
    "ApartmentUnit",
    "Loft",
    "ManufacturedHomeOnLand",
    "ManufacturedHomeInPark",
    "MultiFamilyMoreThan10",
    "MultiFamilyLessThan10",
    "MobileHome",
    "ManufacturedHousingMultiWide",
    "ManufacturedHousing",
    "ManufacturedHousingSingleWide",
    "Modular",
    null,
];
const ALLOWED_PROPERTY_USAGE_TYPES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Agricultural",
  "Recreational",
  "Conservation",
  "Retirement",
  "ResidentialCommonElementsAreas",
  "DrylandCropland",
  "HayMeadow",
  "CroplandClass2",
  "CroplandClass3",
  "TimberLand",
  "GrazingLand",
  "OrchardGroves",
  "Poultry",
  "Ornamentals",
  "Church",
  "PrivateSchool",
  "PrivateHospital",
  "HomesForAged",
  "NonProfitCharity",
  "MortuaryCemetery",
  "ClubsLodges",
  "SanitariumConvalescentHome",
  "CulturalOrganization",
  "Military",
  "ForestParkRecreation",
  "PublicSchool",
  "PublicHospital",
  "GovernmentProperty",
  "RetailStore",
  "DepartmentStore",
  "Supermarket",
  "ShoppingCenterRegional",
  "ShoppingCenterCommunity",
  "OfficeBuilding",
  "MedicalOffice",
  "TransportationTerminal",
  "Restaurant",
  "FinancialInstitution",
  "ServiceStation",
  "AutoSalesRepair",
  "MobileHomePark",
  "WholesaleOutlet",
  "Theater",
  "Entertainment",
  "Hotel",
  "RaceTrack",
  "GolfCourse",
  "LightManufacturing",
  "HeavyManufacturing",
  "LumberYard",
  "PackingPlant",
  "Cannery",
  "MineralProcessing",
  "Warehouse",
  "OpenStorage",
  "Utility",
  "RiversLakes",
  "SewageDisposal",
  "Railroad",
  "TransitionalProperty",
  "ReferenceParcel",
  "NurseryGreenhouse",
  "AgriculturalPackingFacility",
  "LivestockFacility",
  "Aquaculture",
  "VineyardWinery",
  "DataCenter",
  "TelecommunicationsFacility",
  "SolarFarm",
  "WindFarm",
  "NativePasture",
  "ImprovedPasture",
  "Rangeland",
  "PastureWithTimber",
  "Unknown",
  null,
];
const ALLOWED_ATTACHMENT_TYPES = ["Detached", "Attached", "SemiDetached"];
const ALLOWED_EXTERIOR_WALL_MATERIALS = [
  "Wood Siding",
  "Brick",
  "Stucco",
  "Vinyl Siding",
  "Aluminum Siding",
];
const ALLOWED_FLOORING_MATERIALS = [
  "Carpet",
  "Hardwood",
  "Tile",
  "Laminate",
  "Vinyl",
];
const ALLOWED_SUBFLOOR_MATERIALS = ["Concrete Slab", "Wood", "Plywood"];
const ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS = [
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
];
const ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS = [
  "Drywall",
  "Plaster",
  "Paneling",
];
const ALLOWED_ROOF_COVERING_MATERIALS = [
  "Architectural Asphalt Shingle",
  "Asphalt Shingle",
  "Metal",
  "Tile",
  "Wood Shake",
];
const ALLOWED_ROOF_DESIGN_TYPES = [
  "Gable",
  "Hip",
  "Mansard",
  "Flat",
  "Gambrel",
];
const ALLOWED_ROOF_MATERIAL_TYPES = ["Shingle", "Tile", "Metal", "Wood"];
const ALLOWED_FOUNDATION_TYPES = [
  "Slab on Grade",
  "Crawl Space",
  "Basement",
  "Pier and Beam",
];
const ALLOWED_FRAMING_MATERIALS = ["Wood Frame", "Steel Frame", "Concrete"];
const PERSON_ALLOWED_PREFIXES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];
const PERSON_ALLOWED_SUFFIXES = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

function cleanUseCode(str) {
  if (!str) return "";
  return str
    .replace(/\u00a0/g, " ")
    .replace(/^\d+\s*-\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizePropertyType(raw) {
  if (!raw) return null;
  const map = {
    LandParcel: "LandParcel",
    VacantLand: "LandParcel",
    Building: "Building",
    SingleFamily: "Building",
    MultiFamilyLessThan10: "Building",
    MultiFamilyMoreThan10: "Building",
    MiscellaneousResidential: "Building",
    Retirement: "Building",
    MobileHome: "ManufacturedHome",
    ManufacturedHome: "ManufacturedHome",
    Condominium: "Unit",
    Cooperative: "Unit",
  };
  if (ALLOWED_PROPERTY_TYPES.includes(raw)) return raw;
  return map[raw] || null;
}

function firstNonNull(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function sum(values) {
  return values.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

function extractBuildings($) {
  const tables = $("#ctl00_MasterPlaceHolder_tblBldgs > tbody > tr > td > table");
  const buildings = [];

  tables.each((idx, table) => {
    const $tbl = $(table);
    const headerText = $tbl.find("th").first().text();
    const improvementMatch = headerText.match(/Improvement Type:\s*([^,]+)/i);
    const yearBuiltMatch = headerText.match(/Year Built:\s*(\d{4})/i);
    const effectiveYearMatch = headerText.match(/Effective Year:\s*(\d{4})/i);
    const buildingIdMatch = headerText.match(/PA Building ID#:\s*([0-9A-Za-z]+)/i);

    const structuralElements = {};
    $tbl.find("span").each((_, span) => {
      const txt = $(span).text();
      if (/Structural Elements/i.test(txt)) {
        const container = $(span).parent();
        container.find("b").each((__, bold) => {
          const key = $(bold).text().trim().toUpperCase();
          const val = $(bold).next("i").text().trim();
          if (key) structuralElements[key] = val || null;
        });
      }
    });

    const areas = {};
    let totalArea = null;
    const areaSpan = $tbl
      .find("span")
      .filter((_, span) => /Areas\s*-\s*\d+\s*Total\s*SF/i.test($(span).text()))
      .first();
    if (areaSpan.length) {
      const header = areaSpan.text();
      const match = header.match(/Areas\s*-\s*(\d+)\s*Total\s*SF/i);
      if (match) totalArea = parseInt(match[1], 10);
      const container = areaSpan.parent();
      container.find("b").each((__, bold) => {
        const key = $(bold).text().trim().toUpperCase();
        const val = parseInt($(bold).next("i").text().replace(/[^0-9]/g, ""), 10);
        if (key && !Number.isNaN(val)) areas[key] = val;
      });
    }

    const baseArea = areas["BASE AREA"] ?? null;
    const carportArea =
      areas["CARPORT FIN"] ??
      areas["CARPORT UNF"] ??
      areas["CARPORT"] ??
      null;
    const utilityArea =
      areas["UTILITY UNF"] ?? areas["UTILITY FIN"] ?? areas["UTILITY"] ?? null;

    buildings.push({
      index: idx + 1,
      improvementType: improvementMatch ? improvementMatch[1].trim() : null,
      yearBuilt: yearBuiltMatch ? parseInt(yearBuiltMatch[1], 10) : null,
      effectiveYear: effectiveYearMatch ? parseInt(effectiveYearMatch[1], 10) : null,
      buildingId: buildingIdMatch ? buildingIdMatch[1].trim() : null,
      structuralElements,
      areas,
      totalArea: totalArea != null ? totalArea : null,
      baseArea: baseArea != null ? baseArea : null,
      carportArea: carportArea != null ? carportArea : null,
      utilityArea: utilityArea != null ? utilityArea : null,
      dwellingUnits: parseIntSafe(structuralElements["DWELLING UNITS"]),
      numberOfStories: parseIntSafe(structuralElements["NO. STORIES"]),
    });
  });

  return buildings;
}

function formatAddressHtml(htmlContent) {
  if (!htmlContent) return null;
  const parts = htmlContent
    .split(/<br\s*\/?>/i)
    .map((segment) =>
      segment.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ").trim(),
    )
    .filter(Boolean);
  const joined = parts.join(", ");
  return joined.replace(/\s{2,}/g, " ");
}

const getBookPageInfo = (text) => {
  if (!text) return { book: null, page: null, volume: null, instrumentNumber: null };
  const bookMatch = text.match(/Books+([0-9A-Za-z]+)/i);
  const pageMatch = text.match(/Pages+([0-9A-Za-z]+)/i);
  const volumeMatch = text.match(/Vol(?:ume)?s+([0-9A-Za-z]+)/i);
  const instMatch = text.match(/Inst(?:rument)?s+(?:No.?|Number)?s*([0-9A-Za-z]+)/i);
  return {
    book: bookMatch ? bookMatch[1] : null,
    page: pageMatch ? pageMatch[1] : null,
    volume: volumeMatch ? volumeMatch[1] : null,
    instrumentNumber: instMatch ? instMatch[1] : null,
  };
};
function buildStructureFromBuilding(building) {
  const map = building.structuralElements || {};
  const areas = building.areas || {};

  const exteriorWall = (map["EXTERIOR WALL"] || "").toUpperCase();
  const floorCover = (map["FLOOR COVER"] || "").toUpperCase();
  const foundation = (map["FOUNDATION"] || "").toUpperCase();
  const interiorWall = (map["INTERIOR WALL"] || "").toUpperCase();
  const roofCover = (map["ROOF COVER"] || "").toUpperCase();
  const roofFraming = (map["ROOF FRAMING"] || "").toUpperCase();
  const structuralFrame = (map["STRUCTURAL FRAME"] || "").toUpperCase();

  const structure = {
    architectural_style_type: null,
    attachment_type: validateEnum(
      "Detached",
      ALLOWED_ATTACHMENT_TYPES,
      "Structure",
      "attachment_type",
    ),
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary:
      /SIDING/.test(exteriorWall)
        ? validateEnum(
            "Wood Siding",
            ALLOWED_EXTERIOR_WALL_MATERIALS,
            "Structure",
            "exterior_wall_material_primary",
          )
        : /BRICK/.test(exteriorWall)
          ? validateEnum(
              "Brick",
              ALLOWED_EXTERIOR_WALL_MATERIALS,
              "Structure",
              "exterior_wall_material_primary",
            )
          : /STUCCO/.test(exteriorWall)
            ? validateEnum(
                "Stucco",
                ALLOWED_EXTERIOR_WALL_MATERIALS,
                "Structure",
                "exterior_wall_material_primary",
              )
            : null,
    exterior_wall_material_secondary: null,
    finished_base_area:
      typeof building.baseArea === "number"
        ? building.baseArea
        : areas["BASE AREA"] ?? null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: /CARPET/.test(floorCover)
      ? validateEnum(
          "Carpet",
          ALLOWED_FLOORING_MATERIALS,
          "Structure",
          "flooring_material_primary",
        )
      : /WOOD/.test(floorCover)
        ? validateEnum(
            "Hardwood",
            ALLOWED_FLOORING_MATERIALS,
            "Structure",
            "flooring_material_primary",
          )
        : /TILE/.test(floorCover)
          ? validateEnum(
              "Tile",
              ALLOWED_FLOORING_MATERIALS,
              "Structure",
              "flooring_material_primary",
            )
          : null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: /SLAB/.test(foundation)
      ? validateEnum(
          "Slab on Grade",
          ALLOWED_FOUNDATION_TYPES,
          "Structure",
          "foundation_type",
        )
      : /PIER|BEAM/.test(foundation)
        ? validateEnum(
            "Pier and Beam",
            ALLOWED_FOUNDATION_TYPES,
            "Structure",
            "foundation_type",
          )
        : null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: /WOOD/.test(structuralFrame)
      ? validateEnum(
          "Wood Frame",
          ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS,
          "Structure",
          "interior_wall_structure_material",
        )
      : /STEEL/.test(structuralFrame)
        ? validateEnum(
            "Steel Frame",
            ALLOWED_INTERIOR_WALL_STRUCTURE_MATERIALS,
            "Structure",
            "interior_wall_structure_material",
          )
        : null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: /DRYWALL/.test(interiorWall)
      ? validateEnum(
          "Drywall",
          ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS,
          "Structure",
          "interior_wall_surface_material_primary",
        )
      : /PLASTER/.test(interiorWall)
        ? validateEnum(
            "Plaster",
            ALLOWED_INTERIOR_WALL_SURFACE_MATERIALS,
            "Structure",
            "interior_wall_surface_material_primary",
          )
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories:
      typeof building.numberOfStories === "number"
        ? building.numberOfStories
        : null,
    primary_framing_material: /WOOD/.test(structuralFrame)
      ? validateEnum(
          "Wood Frame",
          ALLOWED_FRAMING_MATERIALS,
          "Structure",
          "primary_framing_material",
        )
      : /STEEL/.test(structuralFrame)
        ? validateEnum(
            "Steel Frame",
            ALLOWED_FRAMING_MATERIALS,
            "Structure",
            "primary_framing_material",
          )
        : null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: /ARCH|DIMEN/.test(roofCover)
      ? validateEnum(
          "Architectural Asphalt Shingle",
          ALLOWED_ROOF_COVERING_MATERIALS,
          "Structure",
          "roof_covering_material",
        )
      : /SHINGLE/.test(roofCover)
        ? validateEnum(
            "Asphalt Shingle",
            ALLOWED_ROOF_COVERING_MATERIALS,
            "Structure",
            "roof_covering_material",
          )
        : /METAL/.test(roofCover)
          ? validateEnum(
              "Metal",
              ALLOWED_ROOF_COVERING_MATERIALS,
              "Structure",
              "roof_covering_material",
            )
          : null,
    roof_date: null,
    roof_design_type: /GABLE/.test(roofFraming)
      ? validateEnum(
          "Gable",
          ALLOWED_ROOF_DESIGN_TYPES,
          "Structure",
          "roof_design_type",
        )
      : /HIP/.test(roofFraming)
        ? validateEnum(
            "Hip",
            ALLOWED_ROOF_DESIGN_TYPES,
            "Structure",
            "roof_design_type",
          )
        : null,
    roof_material_type: /SHING/.test(roofCover)
      ? validateEnum(
          "Shingle",
          ALLOWED_ROOF_MATERIAL_TYPES,
          "Structure",
          "roof_material_type",
        )
      : /METAL/.test(roofCover)
        ? validateEnum(
            "Metal",
            ALLOWED_ROOF_MATERIAL_TYPES,
            "Structure",
            "roof_material_type",
          )
        : null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: /SLAB/.test(foundation)
      ? validateEnum(
          "Concrete Slab",
          ALLOWED_SUBFLOOR_MATERIALS,
          "Structure",
          "subfloor_material",
        )
      : null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  return structure;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  // Inputs
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  // const unnormalized = readJSON("unnormalized_address.json"); // No longer needed
  const seed = readJSON("property_seed.json");

  // Owners, utilities, layout
  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
  const layoutDataPath = path.join("owners", "layout_data.json");
  const structureDataPath = path.join("owners", "structure_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJSON(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJSON(utilitiesDataPath)
    : null;
  const layoutData = fs.existsSync(layoutDataPath)
    ? readJSON(layoutDataPath)
    : null;
  const structureData = fs.existsSync(structureDataPath)
    ? readJSON(structureDataPath)
    : null;

  const parcelId =
    seed.parcel_id ||
    seed.parcelId ||
    seed.parcel ||
    (function () {
      let pid = null;
      $('th:contains("General Information")')
        .closest("table")
        .find("tr")
        .each((i, el) => {
          const tds = $(el).find("td");
          if (tds.length >= 2) {
            const label = $(tds.get(0)).text().trim();
            const val = $(tds.get(1)).text().trim();
            if (/Parcel ID/i.test(label)) pid = val;
          }
        });
      return pid;
    })();
  const propertyKey = parcelId ? `property_${parcelId}` : null;

  const ensureRelative = (fileName) =>
    fileName.startsWith("./") ? fileName : `./${fileName}`;
  const stripExtension = (fileName) =>
    fileName.replace(/^\.\//, "").replace(/\.json$/i, "");
  const writeRelationship = (fromFile, toFile) => {
    const relFileName = `relationship_${stripExtension(fromFile)}_has_${stripExtension(toFile)}.json`;
    const payload = {
      from: { "/": ensureRelative(fromFile) },
      to: { "/": ensureRelative(toFile) },
    };
    fs.writeFileSync(
      path.join(dataDir, relFileName),
      JSON.stringify(payload, null, 2),
    );
  };

  // ---------------- Property ----------------
  let legalDesc = null;
  const legalTable = $('th:contains("Legal Description")').closest("table");
  if (legalTable && legalTable.length) {
    const td = legalTable.find("td").first();
    if (td && td.length) legalDesc = td.text().trim();
  }

  const buildings = extractBuildings($);
  const primaryBuilding = buildings[0] || null;

  const totalBaseArea = sum(buildings.map((b) => b.baseArea ?? 0)) || null;
  const totalArea = sum(buildings.map((b) => b.totalArea ?? 0)) || null;
  const totalUnits = sum(buildings.map((b) => b.dwellingUnits ?? 0)) || null;
  const numberOfStories = firstNonNull(
    ...buildings.map((b) => b.numberOfStories ?? null),
  );
  const yearBuilt = firstNonNull(
    primaryBuilding ? primaryBuilding.yearBuilt : null,
    ...buildings.map((b) => b.yearBuilt ?? null),
  );
  const effYear = firstNonNull(
    primaryBuilding ? primaryBuilding.effectiveYear : null,
    ...buildings.map((b) => b.effectiveYear ?? null),
  );

  // Zoning, acreage, section map id (use inner HTML to avoid concatenation)
  let zoning = null;
  let acreage = null;
  let sectionMapId = null;
  const statsHtml = $("#ctl00_MasterPlaceHolder_MapBodyStats").html() || "";
  if (statsHtml) {
    const mz = statsHtml.match(
      /Zoned:[\s\S]*?<br\s*\/?>\s*([A-Za-z0-9\-]+)\s*<br/i,
    );
    if (mz) zoning = mz[1].trim();
    const txtStats = cheerio.load(`<div>${statsHtml}</div>`)("div").text();
    const ma = txtStats.match(/Approx\.\s*Acreage:\s*([0-9.]+)/i);
    if (ma) acreage = parseFloat(ma[1]);
    const ms = txtStats.match(/Section Map Id:\s*([0-9A-Za-z\-]+)/i);
    if (ms) sectionMapId = ms[1].trim();
  }
  let section = null,
    township = null,
    range = null;
  if (sectionMapId) {
    const parts = sectionMapId.split("-");
    if (parts.length >= 3) {
      section = parts[0];
      township = parts[1];
      range = parts[2];
    }
  }

  // Subdivision, lot and block from legal description
  let subdivision = null,
    lot = null,
    block = null;
  if (legalDesc) {
    const mLot = legalDesc.match(/LT\s+(\w+)/i);
    if (mLot) lot = mLot[1];
    const mBlk = legalDesc.match(/BLK\s+(\w+)/i);
    if (mBlk) block = mBlk[1];
    const mSub = legalDesc.match(/BLK\s+\w+\s+(.+?)\s+PB/i);
    if (mSub) subdivision = mSub[1].trim();
  }

  function mapPropertyType($) {
    // Hardcoded property type mapping
    const propertyTypeMapping = [
      {
        escambia_property_type: "VACANT RESIDENTIAL",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Residential",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "SINGLE FAMILY RESID",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "SingleFamilyDetached",
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "MOBILE HOME",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "MobileHome",
        property_usage_type: "Residential",
        property_type: "ManufacturedHome",
      },
      {
        escambia_property_type: "MULTI-FAMILY >=10",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "MultiFamilyMoreThan10",
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "CONDOMINIUM",
        ownership_estate_type: "Condominium",
        build_status: "Improved",
        structure_form: "ApartmentUnit",
        property_usage_type: "Residential",
        property_type: "Unit",
      },
      {
        escambia_property_type: "CONDO-RES UNIT",
        ownership_estate_type: "Condominium",
        build_status: "Improved",
        structure_form: "ApartmentUnit",
        property_usage_type: "Residential",
        property_type: "Unit",
      },
      {
        escambia_property_type: "COOPERATIVE",
        ownership_estate_type: "Cooperative",
        build_status: "Improved",
        structure_form: "ApartmentUnit",
        property_usage_type: "Residential",
        property_type: "Unit",
      },
      {
        escambia_property_type: "RETIREMENT HOME",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Retirement",
        property_type: "Building",
      },
      {
        escambia_property_type: "MISC. RESIDENTIAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "MULTI-FAMILY <=9",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "MultiFamilyLessThan10",
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "* NOT USED *",
        ownership_estate_type: "FeeSimple",
        build_status: null,
        structure_form: null,
        property_usage_type: "Unknown",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "VACANT COMMERCIAL",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Commercial",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "STORE, 1 STORY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "RetailStore",
        property_type: "Building",
      },
      {
        escambia_property_type: "STORE/OFFICE/SFR",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Commercial",
        property_type: "Building",
      },
      {
        escambia_property_type: "DEPARTMENT STORE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "DepartmentStore",
        property_type: "Building",
      },
      {
        escambia_property_type: "SUPERMARKET",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Supermarket",
        property_type: "Building",
      },
      {
        escambia_property_type: "REGIONAL SHOP CTR.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ShoppingCenterRegional",
        property_type: "Building",
      },
      {
        escambia_property_type: "COMMUNITY SHOP CTR.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ShoppingCenterCommunity",
        property_type: "Building",
      },
      {
        escambia_property_type: "OFFICE, 1 STORY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "OfficeBuilding",
        property_type: "Building",
      },
      {
        escambia_property_type: "OFFICE, MULTI-STORY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "OfficeBuilding",
        property_type: "Building",
      },
      {
        escambia_property_type: "PROFESSIONAL BLDG.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "OfficeBuilding",
        property_type: "Building",
      },
      {
        escambia_property_type: "AIRPORT",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "TransportationTerminal",
        property_type: "Building",
      },
      {
        escambia_property_type: "RESTAURANT,CAFETERIA",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Restaurant",
        property_type: "Building",
      },
      {
        escambia_property_type: "DRIVE-IN RESTAURANT",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Restaurant",
        property_type: "Building",
      },
      {
        escambia_property_type: "FINANCIAL, BANK",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "FinancialInstitution",
        property_type: "Building",
      },
      {
        escambia_property_type: "INSURANCE COMPANY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "FinancialInstitution",
        property_type: "Building",
      },
      {
        escambia_property_type: "REPAIR SERVICE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Commercial",
        property_type: "Building",
      },
      {
        escambia_property_type: "SERVICE STATION",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ServiceStation",
        property_type: "Building",
      },
      {
        escambia_property_type: "AUTO SALE, REPAIR",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "AutoSalesRepair",
        property_type: "Building",
      },
      {
        escambia_property_type: "PARKING/MH PARK",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MobileHomePark",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "WHOLESALE OUTLET",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "WholesaleOutlet",
        property_type: "Building",
      },
      {
        escambia_property_type: "FLORIST/GREENHOUSE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Ornamentals",
        property_type: "Building",
      },
      {
        escambia_property_type: "DRIVE-IN/OPEN STADIM",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Theater",
        property_type: "Building",
      },
      {
        escambia_property_type: "THEATER, AUDITORIUM",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Theater",
        property_type: "Building",
      },
      {
        escambia_property_type: "NIGHTCLUB/LOUNGE/BAR",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Entertainment",
        property_type: "Building",
      },
      {
        escambia_property_type: "BOWLING/RINK/POOL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Entertainment",
        property_type: "Building",
      },
      {
        escambia_property_type: "TOURIST ATTRACTION",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Entertainment",
        property_type: "Building",
      },
      {
        escambia_property_type: "CAMP",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Recreational",
        property_type: "Building",
      },
      {
        escambia_property_type: "RACE TRACK",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Entertainment",
        property_type: "Building",
      },
      {
        escambia_property_type: "GOLF COURSE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GolfCourse",
        property_type: "Building",
      },
      {
        escambia_property_type: "HOTEL/MOTEL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Hotel",
        property_type: "Building",
      },
      {
        escambia_property_type: "VACANT INDUSTRIAL",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Industrial",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "LIGHT MANUFACTURING",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "LightManufacturing",
        property_type: "Building",
      },
      {
        escambia_property_type: "HEAVY MANUFACTURING",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "HeavyManufacturing",
        property_type: "Building",
      },
      {
        escambia_property_type: "LUMBER YARD",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "LumberYard",
        property_type: "Building",
      },
      {
        escambia_property_type: "PACKING PLANT",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PackingPlant",
        property_type: "Building",
      },
      {
        escambia_property_type: "CANNERY, BOTTLER",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Cannery",
        property_type: "Building",
      },
      {
        escambia_property_type: "BAKERY, OTHER FOOD",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "LightManufacturing",
        property_type: "Building",
      },
      {
        escambia_property_type: "MINERAL PROCESSING",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MineralProcessing",
        property_type: "Building",
      },
      {
        escambia_property_type: "WAREHOUSE, DISTRIBUT",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Warehouse",
        property_type: "Building",
      },
      {
        escambia_property_type: "OPEN STORAGE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "OpenStorage",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "IMPROV. AGRICULTURAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Agricultural",
        property_type: "Building",
      },
      {
        escambia_property_type: "CROPLAND CLASS I",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "DrylandCropland",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CROPLAND CLASS II",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "CroplandClass2",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CROPLAND CLASS III",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "CroplandClass3",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBER 1",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBER 2",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBER 3",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBER 4",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBER 5",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "TIMBERLAND, MISC.",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TimberLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND I",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND II",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND III",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND IV",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND V",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "GRAZING LAND VI",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GrazingLand",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "ORCHARD, GROVE",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "OrchardGroves",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "POULTRY, BEES",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Poultry",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "DAIRY, FEED LOT",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Agricultural",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "ORNAMENTAL, MISC. AG",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Ornamentals",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "VACANT INSTITUTIONAL",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CHURCH",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Church",
        property_type: "Building",
      },
      {
        escambia_property_type: "PRIVATE SCHOOL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PrivateSchool",
        property_type: "Building",
      },
      {
        escambia_property_type: "PRIVATE HOSPITAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PrivateHospital",
        property_type: "Building",
      },
      {
        escambia_property_type: "HOME FOR AGED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Retirement",
        property_type: "Building",
      },
      {
        escambia_property_type: "CHARITABLE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "NonProfitCharity",
        property_type: "Building",
      },
      {
        escambia_property_type: "MORTUARY, CEMETERY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MortuaryCemetery",
        property_type: "Building",
      },
      {
        escambia_property_type: "CLUB, LODGE, HALL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ClubsLodges",
        property_type: "Building",
      },
      {
        escambia_property_type: "REST HOME, CONVALESC",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "SanitariumConvalescentHome",
        property_type: "Building",
      },
      {
        escambia_property_type: "CULTURAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "CulturalOrganization",
        property_type: "Building",
      },
      {
        escambia_property_type: "* NOT USED *",
        ownership_estate_type: "FeeSimple",
        build_status: null,
        structure_form: null,
        property_usage_type: "Unknown",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "MILITARY",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Military",
        property_type: "Building",
      },
      {
        escambia_property_type: "FOREST, PARK, REC.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ForestParkRecreation",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "PUBLIC SCHOOL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PublicSchool",
        property_type: "Building",
      },
      {
        escambia_property_type: "COLLEGE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "CulturalOrganization",
        property_type: "Building",
      },
      {
        escambia_property_type: "HOSPITAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PublicHospital",
        property_type: "Building",
      },
      {
        escambia_property_type: "COUNTY OWNED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "Building",
      },
      {
        escambia_property_type: "STATE OWNED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "Building",
      },
      {
        escambia_property_type: "FEDERAL OWNED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "Building",
      },
      {
        escambia_property_type: "MUNICIPAL OWNED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "Building",
      },
      {
        escambia_property_type: "LEASEHOLD INTEREST",
        ownership_estate_type: "Leasehold",
        build_status: null,
        structure_form: null,
        property_usage_type: "Unknown",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "UTILITY, GAS, ELECT.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Utility",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "MINING, PETRO, GAS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MineralProcessing",
        property_type: "Building",
      },
      {
        escambia_property_type: "SUBSURFACE RIGHTS",
        ownership_estate_type: "SubsurfaceRights",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Unknown",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "RIGHT-OF-WAY",
        ownership_estate_type: "RightOfWay",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "Unknown",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "SUBMERGED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "RiversLakes",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "WASTE LAND",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "TransitionalProperty",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CLASSIFIED USE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ForestParkRecreation",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CENTRALLY ASSESSED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Utility",
        property_type: "Building",
      },
      {
        escambia_property_type: "NON-AG ACREAGE",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "TransitionalProperty",
        property_type: "LandParcel",
      },
      // New Use Codes
      {
        escambia_property_type: "AIRPORTS/TERMINALS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "TransportationTerminal",
        property_type: "Building",
      },
      {
        escambia_property_type: "AUTO REPAIR",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "AutoSalesRepair",
        property_type: "Building",
      },
      {
        escambia_property_type: "AUTO SALES",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "AutoSalesRepair",
        property_type: "Building",
      },
      {
        escambia_property_type: "CAR WASH",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ServiceStation", // Closest fit
        property_type: "Building",
      },
      {
        escambia_property_type: "CEMETERY-ACTIVE/IN-USE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MortuaryCemetery",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CEMETERY-HISTORICAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MortuaryCemetery",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CEMETERY-INACTIVE/ABANDONED",
        ownership_estate_type: "FeeSimple",
        build_status: "VacantLand",
        structure_form: null,
        property_usage_type: "MortuaryCemetery",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CHARITABLE-FRATERNAL ORG.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "NonProfitCharity",
        property_type: "Building",
      },
      {
        escambia_property_type: "CHARITABLE-YOUTH GROUPS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "NonProfitCharity",
        property_type: "Building",
      },
      {
        escambia_property_type: "COMMERCIAL COMMON ELEMENTS/AREAS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Commercial", // Closest fit
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "CONDO-MARINE DRY STORAGE",
        ownership_estate_type: "Condominium",
        build_status: "Improved",
        structure_form: null, // No direct mapping, could be a type of warehouse/storage
        property_usage_type: "Commercial",
        property_type: "Unit",
      },
      {
        escambia_property_type: "CONDO-NON-RES UNIT",
        ownership_estate_type: "Condominium",
        build_status: "Improved",
        structure_form: "ApartmentUnit", // Generic unit form
        property_usage_type: "Commercial",
        property_type: "Unit",
      },
      {
        escambia_property_type: "CONDO-TIMESHARE",
        ownership_estate_type: "Timeshare",
        build_status: "Improved",
        structure_form: "ApartmentUnit", // Assuming it's a unit in a building
        property_usage_type: "Residential",
        property_type: "Unit",
      },
      {
        escambia_property_type: "FIRE DEPARTMENT",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "GovernmentProperty",
        property_type: "Building",
      },
      {
        escambia_property_type: "IMPROV. AGRICULTURAL-MISC IMPRV.",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Agricultural",
        property_type: "Building",
      },
      {
        escambia_property_type: "IMPROV. AGRICULTURAL-RESIDENTIAL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "SingleFamilyDetached", // Assuming a residential structure on agricultural land
        property_usage_type: "Agricultural",
        property_type: "Building",
      },
      {
        escambia_property_type: "MARINAS/PIERS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Recreational", // Or Commercial
        property_type: "LandParcel", // Or Building if there are structures
      },
      {
        escambia_property_type: "MINI-WAREHOUSES",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Warehouse",
        property_type: "Building",
      },
      {
        escambia_property_type: "MOBILE HOME PARKS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "MobileHomePark",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "MULTI-FAMILY <=9-TWNHSE PROJ",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "TownhouseRowhouse",
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "PARKING LOTS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Commercial", // Often commercial use
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "PRIVATE SCHOOL-DAYCARE",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PrivateSchool",
        property_type: "Building",
      },
      {
        escambia_property_type: "PRIVATE SCHOOL-GRADE SCHOOL",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "PrivateSchool",
        property_type: "Building",
      },
      {
        escambia_property_type: "RESIDENTIAL COMMON ELEMENTS/AREAS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "ResidentialCommonElementsAreas",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "RV PARKS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Recreational",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "SINGLE FAMILY - TOWNHOME",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "TownhouseRowhouse",
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "SINGLE FAMILY IN MULTI-FAM COMPLEX",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: "SingleFamilyDetached", // Could be detached within a complex
        property_usage_type: "Residential",
        property_type: "Building",
      },
      {
        escambia_property_type: "UTILITY-LOCALLY ASSD RAILROADS",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved",
        structure_form: null,
        property_usage_type: "Railroad",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "VACANT COMMERCIAL-IMPRVD",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved", // Improved vacant land
        structure_form: null,
        property_usage_type: "Commercial",
        property_type: "LandParcel",
      },
      {
        escambia_property_type: "VACANT CONDOMINIUM",
        ownership_estate_type: "Condominium",
        build_status: "VacantLand", // Vacant unit
        structure_form: "ApartmentUnit",
        property_usage_type: "Residential",
        property_type: "Unit",
      },
      {
        escambia_property_type: "VACANT RESIDENTIAL - IMPROVED",
        ownership_estate_type: "FeeSimple",
        build_status: "Improved", // Improved vacant land
        structure_form: null,
        property_usage_type: "Residential",
        property_type: "LandParcel",
      },
    ];

    let useCodeDescription = null;

    $('th:contains("General Information")')
      .closest("table")
      .find("tr")
      .each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length >= 2) {
          const label = $(cells.get(0)).text().trim();
          if (/Use Code:/i.test(label)) {
            const cell = $(cells.get(1));
            const rawHtml = cell.html() || "";
            const text = cell.text().trim();
            useCodeDescription = text || rawHtml;
          }
        }
      });

    const cleanedUseCode = cleanUseCode(useCodeDescription);
    if (!cleanedUseCode) {
      throw {
        type: "error",
        message: "Use code not found in source HTML.",
        path: "Property.property_type",
      };
    }

    const mappedType = propertyTypeMapping.find(
      (mapping) =>
        cleanUseCode(mapping.escambia_property_type) === cleanedUseCode,
    );

    if (!mappedType) {
      throw {
        type: "error",
        message: `Use code '${useCodeDescription || cleanedUseCode}' is not mapped to property metadata.`,
        path: "Property.property_type",
      };
    }

    const normalizedPropertyType = normalizePropertyType(
      mappedType.property_type,
    );
    if (!normalizedPropertyType) {
      throw {
        type: "error",
        message: `Unable to normalize property_type '${mappedType.property_type}' for use code '${mappedType.escambia_property_type}'.`,
        path: "Property.property_type",
      };
    }

    return {
      propertyType: validateEnum(
        normalizedPropertyType,
        ALLOWED_PROPERTY_TYPES,
        "Property",
        "property_type",
      ),
      ownershipEstateType: mappedType.ownership_estate_type
        ? validateEnum(
            mappedType.ownership_estate_type,
            ALLOWED_OWNERSHIP_ESTATE_TYPES,
            "Property",
            "ownership_estate_type",
          )
        : null,
      buildStatus: mappedType.build_status
        ? validateEnum(
            mappedType.build_status,
            ALLOWED_BUILD_STATUS,
            "Property",
            "build_status",
          )
        : null,
      structureForm: mappedType.structure_form
        ? validateEnum(
            mappedType.structure_form,
            ALLOWED_STRUCTURE_FORMS,
            "Property",
            "structure_form",
          )
        : null,
      propertyUsageType: mappedType.property_usage_type
        ? validateEnum(
            mappedType.property_usage_type,
            ALLOWED_PROPERTY_USAGE_TYPES,
            "Property",
            "property_usage_type",
          )
        : null,
    };
  }

  const ALLOWED_UNITS_TYPES = ["One", "Two", "Three", "Four"];

  function getUnitsType(units) {
    if (units === 1)
      return validateEnum(
        "One",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 2)
      return validateEnum(
        "Two",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 3)
      return validateEnum(
        "Three",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    if (units === 4)
      return validateEnum(
        "Four",
        ALLOWED_UNITS_TYPES,
        "Property",
        "number_of_units_type",
      );
    return null;
  }

  const propertyInfo = mapPropertyType($);
  const units = totalUnits && totalUnits > 0 ? totalUnits : null;

  const property = {
    parcel_identifier: parcelId || null,
    property_type: propertyInfo.propertyType,
    number_of_units_type: getUnitsType(units),
    number_of_units: units,
    livable_floor_area:
      totalBaseArea != null ? `${totalBaseArea} SF` : null,
    area_under_air: totalBaseArea != null ? `${totalBaseArea} SF` : null,
    total_area: totalArea != null ? `${totalArea} SF` : null,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: effYear || null,
    property_legal_description_text: legalDesc || null,
    subdivision: subdivision || null,
    zoning: zoning || null,
    ownership_estate_type: propertyInfo.ownershipEstateType,
    build_status: propertyInfo.buildStatus,
    structure_form: propertyInfo.structureForm,
    property_usage_type: propertyInfo.propertyUsageType,
  };
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

    // ---------------- Address ----------------
  let situsAddress = null;
  let mailingAddressString = null;
  const generalInfoTable = $('th:contains("General Information")').closest(
    "table",
  );
  if (generalInfoTable && generalInfoTable.length) {
    generalInfoTable.find("tr").each((_, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 2) {
        const label = $(tds.get(0)).text().trim();
        const valueCell = $(tds.get(1));
        if (/Situs:/i.test(label)) {
          situsAddress = valueCell.text().replace(/\u00a0/g, " ").trim().replace(/\s{2,}/g, " ");
        }
        if (/Mail:/i.test(label)) {
          mailingAddressString = formatAddressHtml(valueCell.html());
        }
      }
    });
  }

  const requestIdentifier = seed.request_identifier || parcelId;

  const propertyAddress = {
    source_http_request: seed.source_http_request || null,
    request_identifier: requestIdentifier,
    county_name: "Escambia",
    latitude: null,
    longitude: null,
    unnormalized_address: situsAddress || null,
    municipality_name: null,
    township: township || null,
    range: range || null,
    section: section || null,
    lot: lot || null,
    block: block || null,
  };

  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(propertyAddress, null, 2),
  );

  let mailingAddressRecord = null;
  if (mailingAddressString) {
    mailingAddressRecord = {
      source_http_request: seed.source_http_request || null,
      request_identifier: requestIdentifier,
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddressString,
    };
    fs.writeFileSync(
      path.join(dataDir, "mailing_address.json"),
      JSON.stringify(mailingAddressRecord, null, 2),
    );
  }

  // Define allowed enum values for Lot
  const ALLOWED_LOT_TYPES = [
    "LessThanOrEqualToOneQuarterAcre",
    "GreaterThanOneQuarterAcre",
  ];

  // ---------------- Lot ----------------
  let lot_area_sqft = null;
  if (typeof acreage === "number") {
    lot_area_sqft = Math.round(acreage * 43560);
  }
  const lotJson = {
    lot_type:
      typeof acreage === "number"
        ? acreage <= 0.25
          ? validateEnum(
              "LessThanOrEqualToOneQuarterAcre",
              ALLOWED_LOT_TYPES,
              "Lot",
              "lot_type",
            )
          : validateEnum(
              "GreaterThanOneQuarterAcre",
              ALLOWED_LOT_TYPES,
              "Lot",
              "lot_type",
            )
        : null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lot_area_sqft || null,
    lot_size_acre: typeof acreage === "number" ? acreage : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  fs.writeFileSync(
    path.join(dataDir, "lot.json"),
    JSON.stringify(lotJson, null, 2),
  );

  // ---------------- Tax (all rows) ----------------
  const taxRows = [];
  $('th:contains("Assessments")')
    .closest("table")
    .find("tr[align=right]")
    .each((i, el) => {
      const tds = $(el).find("td");
      if (tds.length >= 5) {
        const year = parseInt($(tds.get(0)).text().trim(), 10);
        const land = parseCurrency($(tds.get(1)).text());
        const imprv = parseCurrency($(tds.get(2)).text());
        const total = parseCurrency($(tds.get(3)).text());
        const capVal = parseCurrency($(tds.get(4)).text());
        taxRows.push({ year, land, imprv, total, capVal });
      }
    });
  taxRows.forEach((r) => {
    const tax = {
      tax_year: r.year,
      property_assessed_value_amount: r.capVal != null ? r.capVal : null,
      property_market_value_amount: r.total != null ? r.total : null,
      property_building_amount: r.imprv != null ? r.imprv : null,
      property_land_amount: r.land != null ? r.land : null,
      property_taxable_value_amount: r.capVal != null ? r.capVal : null,
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    };
    fs.writeFileSync(
      path.join(dataDir, `tax_${r.year}.json`),
      JSON.stringify(tax, null, 2),
    );
  });

  const structureFiles = [];
  let structuresArray = [];
  if (
    propertyKey &&
    structureData &&
    structureData[propertyKey]
  ) {
    const entry = structureData[propertyKey];
    if (Array.isArray(entry.structures)) {
      structuresArray = entry.structures.slice();
    } else if (entry.structure) {
      structuresArray = [entry.structure];
    } else if (Array.isArray(entry)) {
      structuresArray = entry.slice();
    } else if (entry && typeof entry === "object") {
      structuresArray = [entry];
    }
  }

  if (structuresArray.length === 0 && buildings.length > 0) {
    structuresArray = buildings.map((building) =>
      buildStructureFromBuilding(building),
    );
  }

  structuresArray.forEach((structure, idx) => {
    const indexedName = `structure_${idx + 1}.json`;
    fs.writeFileSync(
      path.join(dataDir, indexedName),
      JSON.stringify(structure, null, 2),
    );
    structureFiles.push(indexedName);

  });

  // ---------------- Utilities ----------------
  const utilityFiles = [];
  if (propertyKey && utilitiesData && utilitiesData[propertyKey]) {
    const entry = utilitiesData[propertyKey];
    const utilitiesArray = Array.isArray(entry.utilities)
      ? entry.utilities
      : entry.utility
        ? [entry.utility]
        : [entry];
    utilitiesArray.forEach((utility, idx) => {
      const indexedName = `utility_${idx + 1}.json`;
      fs.writeFileSync(
        path.join(dataDir, indexedName),
        JSON.stringify(utility, null, 2),
      );
      utilityFiles.push(indexedName);

    });
  }

  // ---------------- Layouts ----------------
  const layoutFiles = [];
  const layoutBuildingIndices = [];
  if (
    propertyKey &&
    layoutData &&
    layoutData[propertyKey] &&
    Array.isArray(layoutData[propertyKey].layouts)
  ) {
    const layouts = layoutData[propertyKey].layouts;
    layouts.forEach((lay, idx) => {
      const fileName = `layout_${idx + 1}.json`;
      const layoutCopy = { ...lay };
      delete layoutCopy.space_type_indexer;
      if (typeof layoutCopy.building_number === "string") {
        const parsed = Number(layoutCopy.building_number);
        layoutCopy.building_number = Number.isNaN(parsed)
          ? null
          : parsed;
      }
      const allowedFloorLevels = new Set([
        "1st Floor",
        "2nd Floor",
        "3rd Floor",
        "4th Floor",
      ]);
      if (!allowedFloorLevels.has(layoutCopy.floor_level)) {
        layoutCopy.floor_level = null;
      }
      fs.writeFileSync(
        path.join(dataDir, fileName),
        JSON.stringify(layoutCopy, null, 2),
      );
      layoutFiles.push(fileName);
      if (layoutCopy && layoutCopy.space_type === "Building") {
        layoutBuildingIndices.push(idx + 1);
      }
    });
    if (Array.isArray(layoutData[propertyKey].layout_relationships)) {
      const seen = new Set();
      layoutData[propertyKey].layout_relationships.forEach((rel) => {
        if (
          rel &&
          Number.isInteger(rel.parent) &&
          Number.isInteger(rel.child)
        ) {
          const parentFile = `layout_${rel.parent}.json`;
          const childFile = `layout_${rel.child}.json`;
          const key = `${parentFile}->${childFile}`;
          if (seen.has(key)) return;
          seen.add(key);
          writeRelationship(parentFile, childFile);
        }
      });
    }
  }

  const mapStructureToSource = (structureFile, layoutIdx) => {
    if (layoutIdx != null) {
      writeRelationship(`layout_${layoutIdx}.json`, structureFile);
    } else {
      writeRelationship("property.json", structureFile);
    }
  };

  if (structureFiles.length > 0) {
    if (layoutBuildingIndices.length <= 1) {
      const layoutIdx =
        layoutBuildingIndices.length === 1 ? layoutBuildingIndices[0] : null;
      structureFiles.forEach((structureFile) =>
        mapStructureToSource(structureFile, layoutIdx),
      );
    } else {
      structureFiles.forEach((structureFile, idx) => {
        if (idx < layoutBuildingIndices.length) {
          mapStructureToSource(structureFile, layoutBuildingIndices[idx]);
        } else {
          mapStructureToSource(structureFile, null);
        }
      });
    }
  }

  const mapUtilityToSource = (utilityFile, layoutIdx) => {
    if (layoutIdx != null) {
      writeRelationship(`layout_${layoutIdx}.json`, utilityFile);
    } else {
      writeRelationship("property.json", utilityFile);
    }
  };

  if (utilityFiles.length > 0) {
    if (layoutBuildingIndices.length <= 1) {
      const layoutIdx =
        layoutBuildingIndices.length === 1 ? layoutBuildingIndices[0] : null;
      utilityFiles.forEach((utilityFile) =>
        mapUtilityToSource(utilityFile, layoutIdx),
      );
    } else {
      utilityFiles.forEach((utilityFile, idx) => {
        if (idx < layoutBuildingIndices.length) {
          mapUtilityToSource(utilityFile, layoutBuildingIndices[idx]);
        } else {
          mapUtilityToSource(utilityFile, null);
        }
      });
    }
  }
  // ---------------- Sales, Deeds, Files ----------------
  const salesRows = [];
  const salesTable = $('th:contains("Sales Data")').closest("table");
  salesTable.find("tr").each((i, el) => {
    const tds = $(el).find("td");
    if (
      tds.length === 7 &&
      $(tds.get(0)).text().trim() &&
      $(tds.get(0)).text().trim() !== "Sale Date"
    ) {
      const saleDateRaw = $(tds.get(0)).text().trim();
      const rawBookText = $(tds.get(1)).text().trim();
      const rawPageText = $(tds.get(2)).text().trim();
      const value = parseCurrency($(tds.get(3)).text());
      const typeCd = $(tds.get(4)).text().trim();
      const linkEl = $(tds.get(6)).find("a").first();
      const href =
        linkEl && linkEl.attr("href") ? linkEl.attr("href").trim() : null;
      const extracted = getBookPageInfo(
        `${rawBookText} ${rawPageText} ${href || ""}`,
      );

      const saleDate = isoDateFromMDY(saleDateRaw);

      salesRows.push({
        saleDateRaw,
        saleDate,
        book: extracted.book || (rawBookText || null),
        page: extracted.page || (rawPageText || null),
        volume: extracted.volume || null,
        instrumentNumber: extracted.instrumentNumber || null,
        value,
        typeCd,
        href,
      });
    }
  });

  const ALLOWED_DEED_TYPES = [
    "Warranty Deed",
    "Special Warranty Deed",
    "Quitclaim Deed",
    "Grant Deed",
    "Bargain and Sale Deed",
    "Lady Bird Deed",
    "Transfer on Death Deed",
    "Sheriff's Deed",
    "Tax Deed",
    "Trustee's Deed",
    "Personal Representative Deed",
    "Correction Deed",
    "Deed in Lieu of Foreclosure",
    "Life Estate Deed",
    "Joint Tenancy Deed",
    "Tenancy in Common Deed",
    "Community Property Deed",
    "Gift Deed",
    "Interspousal Transfer Deed",
    "Wild Deed",
    "Special Master's Deed",
    "Court Order Deed",
    "Contract for Deed",
    "Quiet Title Deed",
    "Administrator's Deed",
    "Guardian's Deed",
    "Receiver's Deed",
    "Right of Way Deed",
    "Vacation of Plat Deed",
    "Assignment of Contract",
    "Release of Contract",
    "Miscellaneous",
  ];

  const ALLOWED_DOCUMENT_TYPES = [
    "Title",
    "ConveyanceDeed",
    "ConveyanceDeedWarrantyDeed",
    "ConveyanceDeedQuitClaimDeed",
    "ConveyanceDeedBargainAndSaleDeed",
  ];

  function mapDeedType(code) {
    if (!code) return null;
    const map = {
      CJ: "Personal Representative Deed",
      PR: "Personal Representative Deed",
      CT: "Quiet Title Deed",
      OJ: "Court Order Deed",
      OT: "Transfer on Death Deed",
      QC: "Quitclaim Deed",
      SW: "Special Warranty Deed",
      WD: "Warranty Deed",
      GD: "Grant Deed",
      SC: "Bargain and Sale Deed",
      SD: "Sheriff's Deed",
      TD: "Tax Deed",
      TR: "Trustee's Deed",
      CD: "Correction Deed",
      IL: "Deed in Lieu of Foreclosure",
      LE: "Life Estate Deed",
      JT: "Joint Tenancy Deed",
      TC: "Tenancy in Common Deed",
      CP: "Community Property Deed",
      GP: "Gift Deed",
      IT: "Interspousal Transfer Deed",
      RW: "Right of Way Deed",
      AC: "Assignment of Contract",
      RC: "Release of Contract",
    };
    const deedType = map[code.toUpperCase()];
    return deedType
      ? validateEnum(deedType, ALLOWED_DEED_TYPES, "Deed", "deed_type")
      : null;
  }

  function mapDocumentType(code) {
    const docMap = {
      WD: "ConveyanceDeedWarrantyDeed",
      QC: "ConveyanceDeedQuitClaimDeed",
      SC: "ConveyanceDeedBargainAndSaleDeed",
    };
    const mapped =
      (code && docMap[code.toUpperCase()]) || "Title";
    return validateEnum(
      mapped,
      ALLOWED_DOCUMENT_TYPES,
      "File",
      "document_type",
    );
  }

  const salesFiles = [];
  const deedFiles = [];
  const fileFiles = [];

  salesRows.forEach((row, idx) => {
    const saleFileName = `sales_history_${idx + 1}.json`;
    const salesPayload = {
      ownership_transfer_date: row.saleDate || null,
      purchase_price_amount: row.value != null ? row.value : null,
    };
    fs.writeFileSync(
      path.join(dataDir, saleFileName),
      JSON.stringify(salesPayload, null, 2),
    );
    salesFiles.push(saleFileName);

    const deedType = mapDeedType(row.typeCd);
    const hasDeed =
      deedType ||
      row.book ||
      row.page ||
      row.volume ||
      row.instrumentNumber;
    let deedFileName = null;
    if (hasDeed) {
      deedFileName = `deed_${idx + 1}.json`;
      const deedObj = {};
      if (deedType) deedObj.deed_type = deedType;
      if (row.book) deedObj.book = String(row.book);
      if (row.page) deedObj.page = String(row.page);
      if (row.volume) deedObj.volume = String(row.volume);
      if (row.instrumentNumber)
        deedObj.instrument_number = String(row.instrumentNumber);
      fs.writeFileSync(
        path.join(dataDir, deedFileName),
        JSON.stringify(deedObj, null, 2),
      );
      writeRelationship(saleFileName, deedFileName);
    }
    deedFiles.push(deedFileName);

    const hasFile =
      row.href ||
      row.book ||
      row.page ||
      row.volume ||
      row.instrumentNumber;
    let fileFileName = null;
    if (hasFile) {
      fileFileName = `file_${idx + 1}.json`;
      const fileObj = {
        file_format: null,
        name:
          row.book && row.page
            ? `Instrument OR Book ${row.book} Page ${row.page}`
            : null,
        original_url: row.href || null,
        ipfs_url: null,
        document_type: mapDocumentType(row.typeCd),
      };
      fs.writeFileSync(
        path.join(dataDir, fileFileName),
        JSON.stringify(fileObj, null, 2),
      );
      if (deedFileName) {
        writeRelationship(deedFileName, fileFileName);
      }
    }
    fileFiles.push(fileFileName);
  });

  const latestSaleIdx = salesRows.reduce((acc, row, idx) => {
    if (!row.saleDate) return acc;
    if (acc === null) return idx;
    const accRow = salesRows[acc];
    if (!accRow.saleDate) return idx;
    return row.saleDate > accRow.saleDate ? idx : acc;
  }, null);

  // ---------------- Owners ----------------
  const personFiles = [];
  const companyFiles = [];
  if (
    propertyKey &&
    ownerData &&
    ownerData[propertyKey] &&
    ownerData[propertyKey].owners_by_date &&
    Array.isArray(ownerData[propertyKey].owners_by_date.current)
  ) {
    const currentOwners = ownerData[propertyKey].owners_by_date.current;
    currentOwners.forEach((owner) => {
      if (owner.type === "person") {
        const index = personFiles.length + 1;
        const personFile = `person_${index}.json`;
        const first = toTitleCase(owner.first_name || "");
        const last = toTitleCase(owner.last_name || "");
        const middle = owner.middle_name ? toTitleCase(owner.middle_name) : null;
        const prefix =
          owner.prefix_name &&
          PERSON_ALLOWED_PREFIXES.includes(owner.prefix_name)
            ? owner.prefix_name
            : null;
        const suffix =
          owner.suffix_name &&
          PERSON_ALLOWED_SUFFIXES.includes(owner.suffix_name)
            ? owner.suffix_name
            : null;
        const personPayload = {
          birth_date: null,
          first_name: first,
          last_name: last,
          middle_name: middle,
          prefix_name: prefix,
          suffix_name: suffix,
          us_citizenship_status: null,
          veteran_status: null,
        };
        fs.writeFileSync(
          path.join(dataDir, personFile),
          JSON.stringify(personPayload, null, 2),
        );
        personFiles.push(personFile);
      } else if (owner.type === "company") {
        const index = companyFiles.length + 1;
        const companyFile = `company_${index}.json`;
        const companyPayload = { name: owner.name || null };
        fs.writeFileSync(
          path.join(dataDir, companyFile),
          JSON.stringify(companyPayload, null, 2),
        );
        companyFiles.push(companyFile);
      }
    });
  }

  if (latestSaleIdx !== null && salesFiles[latestSaleIdx]) {
    const saleFileName = salesFiles[latestSaleIdx];
    personFiles.forEach((fileName) => {
      writeRelationship(saleFileName, fileName);
    });
    companyFiles.forEach((fileName) => {
      writeRelationship(saleFileName, fileName);
    });
  }

  if (mailingAddressRecord) {
    personFiles.forEach((fileName) => {
      writeRelationship(fileName, "mailing_address.json");
    });
    companyFiles.forEach((fileName) => {
      writeRelationship(fileName, "mailing_address.json");
    });
  }

  // Relationships for each deed and file
  deedFiles.forEach((deedFile, idx) => {
    const fileFile = fileFiles[idx];
    if (deedFile && fileFile) {
      writeRelationship(deedFile, fileFile);
    }
  });

  deedFiles.forEach((deedFile, idx) => {
    const saleFile = salesFiles[idx];
    if (deedFile && saleFile) {
      writeRelationship(saleFile, deedFile);
    }
  });
}

if (require.main === module) {
  main();
}