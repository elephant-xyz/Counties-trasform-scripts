// structureMapping.js
// Reads input.json, extracts structural attributes, and writes owners/structure_data.json per schema.

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio"); // For any HTML parsing needs (not used here, but available per requirements)

// Embed the provided input data as a fallback to create input.json if it doesn't exist
const embeddedInput = {
  parcelQuickSearchSummary: [
    {
      ownerName: " CHESTER S PECKETT TRUST",
      propertyAddress: "6408 PLYMOUTH SORRENTO RD ",
      isHomestead: "False",
      parcelId: "272001000000005",
      totalCount: 1,
    },
  ],
  parcelNonAdValoremAssessments: [
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      levyingAuthority: "COUNTY SPECIAL ASSESSMENT",
      description: "WASTE PRO OF FL - GARBGE - (407)836-6601",
      units: 2,
      rate: 400,
      assessment: 800,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2024,
      levyingAuthority: "COUNTY SPECIAL ASSESSMENT",
      description: "ADVANCED DISP - GARBGE - (407)836-6601",
      units: 2,
      rate: 300,
      assessment: 600,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2023,
      levyingAuthority: "COUNTY SPECIAL ASSESSMENT",
      description: "ADVANCED DISP - GARBGE - (407)836-6601",
      units: 2,
      rate: 290,
      assessment: 580,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2022,
      levyingAuthority: "COUNTY SPECIAL ASSESSMENT",
      description: "ADVANCED DISP - GARBGE - (407)836-6601",
      units: 2,
      rate: 260,
      assessment: 520,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2021,
      levyingAuthority: "COUNTY SPECIAL ASSESSMENT",
      description: "ADVANCED DISP - GARBGE - (407)836-6601",
      units: 2,
      rate: 250,
      assessment: 500,
    },
  ],
  parcelTotalTaxesSummary: [
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      totalMillageRate: "16.085800000000003",
      adValoremTaxes: "4113.87",
      nonAdValoremTaxes: 800,
      grossTaxes: 4913.87,
      nonExemptTaxes: 5509.05,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2024,
      totalMillageRate: "16.1008",
      adValoremTaxes: "3941.34",
      nonAdValoremTaxes: 600,
      grossTaxes: 4541.34,
      nonExemptTaxes: 5503.06,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2023,
      totalMillageRate: "15.457799999999999",
      adValoremTaxes: "3199.23",
      nonAdValoremTaxes: 580,
      grossTaxes: 3779.23,
      nonExemptTaxes: 4147.2,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2022,
      totalMillageRate: "15.516900000000001",
      adValoremTaxes: "2595.1299999999997",
      nonAdValoremTaxes: 520,
      grossTaxes: 3115.13,
      nonExemptTaxes: 3001.95,
    },
    {
      parcelId: "272001000000005",
      taxYear: 2021,
      totalMillageRate: "15.813400000000001",
      adValoremTaxes: "2525.43",
      nonAdValoremTaxes: 500,
      grossTaxes: 3025.43,
      nonExemptTaxes: 3050.99,
    },
  ],
  parcelValuationStats: {
    taxYear: 2025,
    parcelId: "272001000000005",
    valuationMethod: "M",
    assessedValue: 197702,
    isCertified: "True",
    isHomestead: "False",
    hasPortability: "False",
    hasAg: "False",
    hasIncomeProForma: "0",
  },
  parcelGeneralProfile: {
    taxYear: 2025,
    prcTaxYear: 2025,
    trimYear: 2025,
    showFlag: true,
    parcelId: "272001000000005",
    ownerName: " CHESTER S PECKETT TRUST",
    propertyName: null,
    propertyAddress: "6408 PLYMOUTH SORRENTO RD ",
    mailAddress: "15815 Acorn Cir",
    mailCity: "Tavares",
    mailState: "FL",
    mailZip: "32778-9447",
    country: null,
    propertyCity: "Apopka",
    propertyState: "FL",
    propertyZip: "32712",
    dorCode: "0200",
    dorDescription: "MANUFACTURED HOME",
    cityDescription: "UN-INCORPORATED",
    streetNumber: 6408,
    streetName: "PLYMOUTH SORRENTO",
    instNum: "",
  },
  parcelPropertyValuesByYear: [
    {
      marketPercent: null,
      assessedPercent: null,
      parcelId: "272001000000005",
      showFlag: 1,
      taxYear: 2025,
      landValue: 314600,
      buildingValue: 7860,
      featuresValue: 20019,
      marketValue: 342479,
      valuationMethod: "M",
      assessedValue: 197702,
      isCertified: true,
      isHomestead: "False",
      isAg: "False",
      originalHx: 0,
      additionalHx: 0,
      otherExemptions: 0,
      lis: 0,
      sohCap: 144777,
      taxSavings: 1395,
      hasBenefits: "0",
    },
    {
      marketPercent: null,
      assessedPercent: null,
      parcelId: "272001000000005",
      showFlag: 1,
      taxYear: 2024,
      landValue: 314600,
      buildingValue: 7169,
      featuresValue: 20019,
      marketValue: 341788,
      valuationMethod: "M",
      assessedValue: 179729,
      isCertified: true,
      isHomestead: "False",
      isAg: "False",
      originalHx: 0,
      additionalHx: 0,
      otherExemptions: 0,
      lis: 0,
      sohCap: 162059,
      taxSavings: 1562,
      hasBenefits: "0",
    },
    {
      marketPercent: null,
      assessedPercent: null,
      parcelId: "272001000000005",
      showFlag: 1,
      taxYear: 2023,
      landValue: 242000,
      buildingValue: 6273,
      featuresValue: 20019,
      marketValue: 268292,
      valuationMethod: "M",
      assessedValue: 163390,
      isCertified: true,
      isHomestead: "False",
      isAg: "False",
      originalHx: 0,
      additionalHx: 0,
      otherExemptions: 0,
      lis: 0,
      sohCap: 104902,
      taxSavings: 948,
      hasBenefits: "0",
    },
    {
      marketPercent: null,
      assessedPercent: null,
      parcelId: "272001000000005",
      showFlag: 1,
      taxYear: 2022,
      landValue: 169400,
      buildingValue: 4044,
      featuresValue: 20019,
      marketValue: 193463,
      valuationMethod: "M",
      assessedValue: 148536,
      isCertified: true,
      isHomestead: "False",
      isAg: "False",
      originalHx: 0,
      additionalHx: 0,
      otherExemptions: 0,
      lis: 0,
      sohCap: 44927,
      taxSavings: 407,
      hasBenefits: "0",
    },
  ],
  parcelCertifiedTaxesByAuthority: [
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "Public Schools:   By State Law (Rle)",
      assessedValue: 342479,
      exemption: 0,
      taxValue: 342479,
      millageRate: 3.201,
      previousMillageRate: 3.216,
      millagePercent: -0.0046641827,
      isCertified: "True",
      isHomestead: "False",
      taxes: 1096.2753,
      taxType: "SCH",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "Public Schools:   By Local Board",
      assessedValue: 342479,
      exemption: 0,
      taxValue: 342479,
      millageRate: 3.248,
      previousMillageRate: 3.248,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 1112.3718,
      taxType: "SCH",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "General County",
      assessedValue: 197702,
      exemption: 0,
      taxValue: 197702,
      millageRate: 4.4347,
      previousMillageRate: 4.4347,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 876.7491,
      taxType: "CTY",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "Unincorporated County Fire",
      assessedValue: 197702,
      exemption: 0,
      taxValue: 197702,
      millageRate: 2.8437,
      previousMillageRate: 2.8437,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 562.2052,
      taxType: "OTH",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "Unincorporated Taxing District",
      assessedValue: 197702,
      exemption: 0,
      taxValue: 197702,
      millageRate: 1.8043,
      previousMillageRate: 1.8043,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 356.7137,
      taxType: "OTH",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "Library - Operating Budget",
      assessedValue: 197702,
      exemption: 0,
      taxValue: 197702,
      millageRate: 0.3748,
      previousMillageRate: 0.3748,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 74.09871,
      taxType: "OTH",
    },
    {
      parcelId: "272001000000005",
      taxYear: 2025,
      taxingAuthority: "St Johns Water Management District",
      assessedValue: 197702,
      exemption: 0,
      taxValue: 197702,
      millageRate: 0.1793,
      previousMillageRate: 0.1793,
      millagePercent: 0,
      isCertified: "True",
      isHomestead: "False",
      taxes: 35.447968,
      taxType: "OTH",
    },
  ],
  parcelLandFeatures: [
    {
      landDorCode: "0200",
      descShort: "MANUFACTURED HOME",
      zoning: "ORG-A-1",
      landQty: 4.84,
      landQtyCode: "A",
      unitPrice: 65000,
      landValue: 314600,
      classUnitPrice: 0,
      classValue: 0,
      totalCount: 1,
    },
  ],
  parcelLegalDescription: {
    propertyDescription:
      "THE NE1/4 OF NE1/4 OF SE1/4 (LESS N1/4 & LESS S1/4 THEREOF & LESS RD R/W ON E) OF SEC 01-20-27",
  },
  parcelBuildingFeatures: [
    {
      model: "2",
      descModel: "Manufactured Home",
      bldgDorCode: "0201",
      descBldg: "Mobile Home",
      bldgValue: 7860,
      estNewCost: 26200,
      dateBuilt: "1971-01-01T00:00:00",
      beds: 3,
      baths: 2,
      floors: 1,
      grossArea: 2604,
      livingArea: 0,
      extWall: "Modl.Metal",
      intWall: "Wall.Bd/Wd",
      totalCount: 1,
      buildingId: 1568525,
      buildingNum: 1,
    },
  ],
  parcelExtraFeatures: [
    {
      xfobCode: "3",
      descShort: null,
      dateBuilt: "1995-01-01T00:00:00",
      xfobQty: 10560,
      xfobValue: 7920,
      totalCount: 6,
    },
    {
      xfobCode: "3793",
      descShort: null,
      dateBuilt: "1994-01-01T00:00:00",
      xfobQty: 1,
      xfobValue: 1000,
      totalCount: 6,
    },
    {
      xfobCode: "4",
      descShort: null,
      dateBuilt: "1994-01-01T00:00:00",
      xfobQty: 4992,
      xfobValue: 5067,
      totalCount: 6,
    },
    {
      xfobCode: "GRNH",
      descShort: null,
      dateBuilt: "1985-01-01T00:00:00",
      xfobQty: 2870,
      xfobValue: 2870,
      totalCount: 6,
    },
    {
      xfobCode: "GRNH",
      descShort: null,
      dateBuilt: "1985-01-01T00:00:00",
      xfobQty: 2162,
      xfobValue: 2162,
      totalCount: 6,
    },
    {
      xfobCode: "PT1",
      descShort: null,
      dateBuilt: "1985-01-01T00:00:00",
      xfobQty: 1,
      xfobValue: 1000,
      totalCount: 6,
    },
  ],
  parcelLandAreaSummary: {
    acreage: 4.84364,
    sqft: 210988,
    instrNum: "",
  },
  parcelSalesHistory: [
    {
      saleDate: "2015-12-31T00:00:00",
      saleAmt: 0,
      instrNum: "20160036447",
      book: "",
      page: "",
      seller: "PECKETTS INC, ",
      buyer: "CHESTER S PECKETT TRUST, ",
      deedDesc: "QUIT CLAIM DEED - MULTIPLE PARCELS",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "2010-12-29T00:00:00",
      saleAmt: 93500,
      instrNum: "20100734662",
      book: "10152",
      page: "4412",
      seller: "PECKETT CHESTER S TR, PECKETT BARBARA H TR",
      buyer: "PECKETTS INC, ",
      deedDesc: "QUIT CLAIM DEED - MULTIPLE PARCELS",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "2006-09-20T00:00:00",
      saleAmt: 300000,
      instrNum: "20060690839",
      book: "08924",
      page: "1687",
      seller: "HICKMAN NORMAN G JR, HICKMAN FRANCES M",
      buyer: "PECKETT CHESTER S TR, PECKETT BARBARA H TR",
      deedDesc: "WARRANTY DEED",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "1982-01-01T00:00:00",
      saleAmt: 60000,
      instrNum: "19821747294",
      book: "03254",
      page: "1379",
      seller: ", ",
      buyer: ", ",
      deedDesc: "WARRANTY DEED",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "1979-12-01T00:00:00",
      saleAmt: 38000,
      instrNum: "19791465503",
      book: "03075",
      page: "0337",
      seller: ", ",
      buyer: ", ",
      deedDesc: "WARRANTY DEED",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "1979-06-01T00:00:00",
      saleAmt: 100,
      instrNum: "19791411868",
      book: "03031",
      page: "1419",
      seller: ", ",
      buyer: ", ",
      deedDesc: "QUIT CLAIM DEED",
      vacImpCode: "Improved",
      totalCount: 7,
    },
    {
      saleDate: "1975-06-01T00:00:00",
      saleAmt: 100,
      instrNum: "19750868328",
      book: "02602",
      page: "1496",
      seller: ", ",
      buyer: ", ",
      deedDesc: "QUIT CLAIM DEED",
      vacImpCode: "Improved",
      totalCount: 7,
    },
  ],
};

function ensureInputFile() {
  const inputPath = path.resolve("input.json");
  try {
    if (!fs.existsSync(inputPath)) {
      fs.writeFileSync(
        inputPath,
        JSON.stringify(embeddedInput, null, 2),
        "utf-8",
      );
    }
  } catch (e) {
    // If any error writing, attempt to continue using embedded data directly
  }
}

function loadInput() {
  const inputPath = path.resolve("input.json");
  if (!fs.existsSync(inputPath)) {
    ensureInputFile();
  }
  try {
    const raw = fs.readFileSync(inputPath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    // Fallback to embedded
    return embeddedInput;
  }
}

function mapExteriorWallMaterial(extWall) {
  if (!extWall) return null;
  const s = String(extWall).toLowerCase();
  if (s.includes("metal")) return "Metal Siding";
  if (s.includes("brick")) return "Brick";
  if (s.includes("stucco")) return "Stucco";
  if (s.includes("wood")) return "Wood Siding";
  return null;
}

function buildStructure(input) {
  const parcel = input.parcelGeneralProfile || {};
  const bldg =
    (input.parcelBuildingFeatures && input.parcelBuildingFeatures[0]) || {};

  const extWallPrimary = mapExteriorWallMaterial(bldg.extWall);

  const structure = {
    architectural_style_type: null,
    attachment_type: "Detached",
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: "Unknown",
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: "Unknown",
    exterior_wall_material_primary: extWallPrimary,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: "Unknown",
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: "Pier and Beam",
    foundation_waterproofing: "Unknown",
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: "Paint",
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: "Wood Frame",
    interior_wall_structure_material_primary: "Wood Frame",
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary:
      bldg.intWall && String(bldg.intWall).toLowerCase().includes("wd")
        ? "Wood Paneling"
        : null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: bldg.floors || null,
    primary_framing_material: "Wood Frame",
    secondary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: "Unknown",
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: "Unknown",
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
  ensureInputFile();
  const input = loadInput();
  const parcelId =
    (input.parcelGeneralProfile && input.parcelGeneralProfile.parcelId) ||
    (input.parcelQuickSearchSummary &&
      input.parcelQuickSearchSummary[0] &&
      input.parcelQuickSearchSummary[0].parcelId) ||
    "unknown";

  const structure = buildStructure(input);

  const ownersDir = path.resolve("owners");
  if (!fs.existsSync(ownersDir)) fs.mkdirSync(ownersDir, { recursive: true });

  const outPath = path.join(ownersDir, "structure_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf-8");
}

if (require.main === module) {
  main();
}
