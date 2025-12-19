// structureMapping.js
// Reads input.html, parses with cheerio, extracts structure data, and writes owners/structure_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const FEATURE_DESCRIPTIONS = {
  "0100": "ATM",
  "0150": "AWNING",
  "0155": "CANOPY",
  "0200": "BAR-B-Q",
  "0250": "BARN-PO",
  "0251": "BRN-PO-FL",
  "0252": "BRN-PO-W-F",
  "0255": "BARN PW",
  "0300": "BARN-WA",
  "0350": "BARN-WB",
  "0400": "BARN-WC",
  "0450": "BARN-MA",
  "0525": "BARN-UC",
  "0555": "BELL TOWER",
  "0700": "BLDG-SV",
  "0725": "BLDG-UC",
  "0750": "BATH HSE A",
  "0751": "BATH HSE B",
  "0800": "BLK TOP A",
  "0801": "BLK TOP B",
  "0802": "RUNWAY",
  "0850": "CONCR SLAB",
  "0851": "CONC LOADING PLTFRM",
  "0852": "CONTROL TOWER",
  "0855": "RSD CONC SLAB",
  "0860": "DRVWY CONC",
  "0861": "DRVWY ASPH<10000 SF",
  "0862": "DRVWY BRCK",
  "0863": "DRVWY RIBN",
  "0865": "DRVWY ASPH>10000 SF",
  "0900": "COOLER",
  "0950": "COTTAGE",
  "1000": "CARPRT-F",
  "1050": "CARPRT-U",
  "1051": "COMM SPA",
  "1125": "DOCK CONC",
  "1150": "DOCK-WD",
  "1155": "CONC DOCK",
  "1200": "DOG KENL",
  "1250": "DROP WNDW",
  "1255": "DUGOUT",
  "1350": "ELEV-PSS",
  "1400": "FNC CH L3/4",
  "1405": "FNC CH L5",
  "1410": "FNC CH L6",
  "1420": "FNC CH L8",
  "1425": "FNC CH L10",
  "1430": "FNC CH L12",
  "1433": "FNC CH L16",
  "1435": "FENCE BRK",
  "1440": "FENCE CB",
  "1445": "FNC ORN BK",
  "1446": "FNC PICKET",
  "1450": "FENCE WD",
  "1455": "FENCE VINYL",
  "1460": "FENCE IRON",
  "1465": "FENCE METAL",
  "1515": "FPLC-C",
  "1518": "FREZ DR 6",
  "1519": "FREZ DR 10",
  "1521": "FUEL-CONC",
  "1550": "GAR-CB-U",
  "1551": "GAR-CB-F",
  "1555": "GAR-FR-U",
  "1556": "GAR-FR-F",
  "1560": "GAR-MTL",
  "1561": "GAR-QUON",
  "1565": "GAR-UC",
  "1600": "GAZEB",
  "1650": "GHSE-F",
  "1655": "GHSE-G",
  "1660": "GHSE-V",
  "1665": "GHSE-A1",
  "1670": "GHSE-A2",
  "1675": "GHSE-A3",
  "1680": "GHSE-A4",
  "1685": "GHSE-A5",
  "1690": "GHSE-A6",
  "1695": "GHSE-A7",
  "1699": "GHSE-UC",
  "1700": "GR STD O",
  "1702": "GR STD C B",
  "1725": "HSE-SV",
  "1750": "JACUZZI",
  "1752": "INSUL 4",
  "1755": "LANAI-O",
  "1760": "MEZZ-F",
  "1765": "MEZZ-U",
  "1770": "MH-SV",
  "1771": "RV ST A",
  "1772": "RV ST B",
  "1774": "MH-ELECT",
  "1775": "MH-CONN",
  "1776": "MH-SEPTIC",
  "1778": "MH-WELL",
  "1796": "MH ST A",
  "1797": "MH ST B",
  "1825": "MH-OP C",
  "1830": "MH-OP R",
  "1835": "MH-SP",
  "1900": "OHDOR L",
  "1905": "OHDOR M",
  "1910": "OHDOR S",
  "1915": "PATIO R",
  "1916": "PATIO B",
  "1917": "PATIO C",
  "1918": "PATIO F",
  "1919": "PATIO M",
  "1920": "PATIO P",
  "1921": "PATIO S",
  "1925": "PVMT C",
  "1935": "PIER R",
  "1940": "PL CG F",
  "1941": "PL CG G-M",
  "1945": "PL HSE",
  "1950": "POOL C",
  "1955": "POOL R",
  "1959": "POOL WADE",
  "1960": "POOL VNL",
  "1961": "PUMP HS",
  "1967": "SEAWALL",
  "1968": "SEAWALL UC",
  "1975": "SWR PLT",
  "1980": "SCALE",
  "1981": "SHED SUPR",
  "1985": "SHED FR",
  "1986": "SHED MT",
  "1987": "SHED PO",
  "1990": "SHED SV",
  "1991": "SHED-F",
  "1992": "SHED-FS",
  "1993": "SHED-A",
  "1994": "SHED-AS",
  "1995": "SHED-G",
  "1996": "SHED-GS",
  "1997": "SHED-E",
  "1998": "SHED-ES",
  "1999": "SHED-UC",
  "2000": "SLRM",
  "2001": "SB CRT",
  "2003": "SIDEWALK",
  "2004": "WALK-PATH",
  "2005": "SPKLR-C",
  "2012": "TANK 500",
  "2013": "TANK 1000",
  "2014": "TANK 10000",
  "2015": "TANK-S",
  "2016": "TANK FD 6T",
  "2017": "TANK FD 21",
  "2020": "T CT BT",
  "2021": "T CT CL",
  "2022": "T CT CO",
  "2025": "UTY FIN",
  "2026": "UTY UNF",
  "2027": "UTY CB",
  "2030": "VAULT A",
  "2031": "VAULT DR",
  "2032": "VACUUM",
  "2035": "WTR PLT",
  "2036": "WTR TWR A",
};

const UTILITY_KEYWORDS = [
  /SEPTIC/,
  /WELL/,
  /PUMP/,
  /TANK/,
  /UTILITY/,
  /UTIL/,
  /SPKLR/,
  /SPRINK/,
  /COOLER/,
  /SWR/,
  /SEWER/,
  /WTR/,
  /WATER/,
  /FUEL/,
  /VACUUM/,
];

const STRUCTURE_KEYWORDS = [
  /BARN/,
  /BLDG/,
  /\bHSE\b/,
  /HOUSE/,
  /COTTAGE/,
  /GAR/,
  /CARPRT/,
  /CARPORT/,
  /SHED/,
  /GHSE/,
  /GREENH/,
  /MEZZ/,
  /GAZEB/,
  /CABIN/,
  /MH/,
  /LANAI/,
  /DOCK/,
  /PIER/,
  /BATH/,
  /CANOPY/,
  /AWNING/,
];

function lookupFeatureDescription(code, rawDescription) {
  const fallback = rawDescription ? rawDescription.trim() : "";
  return (FEATURE_DESCRIPTIONS[code] || fallback || "").trim();
}

function mapLayoutType(description) {
  const upper = description.toUpperCase();
  if (upper.includes("POOL HOUSE") || upper.includes("PL HSE")) return "Pool House";
  if (upper.includes("HOT TUB") || upper.includes("SPA") || upper.includes("JACUZZI")) {
    return "Hot Tub / Spa Area";
  }
  if (upper.includes("POOL")) {
    if (upper.includes("IND")) return "Indoor Pool";
    if (upper.includes("WADE")) return "Outdoor Pool";
    return "Outdoor Pool";
  }
  if (upper.includes("PATIO")) return "Patio";
  if (upper.includes("LANAI")) return "Lanai";
  if (upper.includes("PORCH")) {
    if (upper.includes("SCREEN")) return "Screened Porch";
    return "Porch";
  }
  if (upper.includes("DECK")) return "Deck";
  if (upper.includes("GAZEB")) return "Gazebo";
  if (upper.includes("PERG")) return "Pergola";
  if (upper.includes("OUTDOOR KITCH") || upper.includes("OUTDR KITCH")) {
    return "Outdoor Kitchen";
  }
  if (upper.includes("CARPRT") || upper.includes("CARPORT")) return "Carport";
  if (upper.includes("SHED")) return "Shed";
  if (upper.includes("BARN")) return "Barn";
  if (upper.includes("BALCONY")) return "Balcony";
  if (upper.includes("TERRACE")) return "Terrace";
  if (upper.includes("POOL AREA")) return "Pool Area";
  return null;
}

function mapLayoutFlooring(layoutType) {
  switch (layoutType) {
    case "Patio":
    case "Porch":
    case "Screened Porch":
    case "Lanai":
    case "Outdoor Kitchen":
    case "Outdoor Pool":
    case "Indoor Pool":
    case "Pool Area":
    case "Hot Tub / Spa Area":
    case "Pool House":
    case "Carport":
      return "PouredConcrete";
    case "Deck":
    case "Gazebo":
    case "Pergola":
    case "Shed":
    case "Barn":
      return "Wood";
    default:
      return null;
  }
}

function analyzeFeature(code, rawDescription) {
  const description = lookupFeatureDescription(code, rawDescription);
  const upper = description.toUpperCase();
  const layoutType = mapLayoutType(description);
  let target = null;
  if (layoutType) {
    target = "layout";
  } else if (UTILITY_KEYWORDS.some((pattern) => pattern.test(upper))) {
    target = "utility";
  } else if (STRUCTURE_KEYWORDS.some((pattern) => pattern.test(upper))) {
    target = "structure";
  }
  return {
    code,
    description,
    target,
    layoutType,
    layoutFlooring: layoutType ? mapLayoutFlooring(layoutType) : null,
    flags: {
      hasSeptic: upper.includes("SEPTIC"),
      hasWell: upper.includes("WELL"),
    },
  };
}

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function parseIntSafe(str) {
  if (!str) return null;
  const m = String(str).replace(/[,\s]/g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function extractParcelId($) {
  // Updated selector based on the provided HTML
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function extractBuildingData($) {
  // Updated selector based on the provided HTML
  const rows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr[bgcolor]",
  );
  let mainBaseSF = null;
  let mainActualSF = null;
  let buildingCount = 0;
  const descriptions = [];

  rows.each((i, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      buildingCount += 1;
      const desc = $(tds[1]).text().trim();
       descriptions.push(desc);
      const base = parseIntSafe($(tds[3]).text());
      const actual = parseIntSafe($(tds[4]).text());

      // Changed from OFFICE to SINGLE FAM as per the provided HTML
      if (mainBaseSF === null && /SINGLE FAM/i.test(desc)) {
        mainBaseSF = base;
        mainActualSF = actual;
      }
      // Fallback: if no explicit SINGLE FAM match, use the first row as main
      if (mainBaseSF === null && i === 0) {
        mainBaseSF = base;
        mainActualSF = actual;
      }
    }
  });

  return { mainBaseSF, mainActualSF, buildingCount, descriptions };
}

function buildStructureObject(parsed) {
  const {
    mainBaseSF = null,
    mainActualSF = null,
    buildingCount = null,
    descriptions = [],
    extraStructureCount = 0,
  } = parsed || {};

  const finished_upper_story_area =
    mainBaseSF != null && mainActualSF != null && mainActualSF > mainBaseSF
      ? mainActualSF - mainBaseSF
      : null;

  let attachmentType = null;
  const primaryDesc = descriptions.length ? descriptions[0].toUpperCase() : "";
  if (primaryDesc.includes("DUPLEX")) {
    attachmentType = "SemiDetached";
  } else if (primaryDesc.includes("TRI") || primaryDesc.includes("QUAD")) {
    attachmentType = "Attached";
  } else {
    attachmentType = "Detached";
  }

  const structure = {
    // Optional/top-level helpful fields
    number_of_buildings:
      (buildingCount != null ? buildingCount : 0) + extraStructureCount || null,
    finished_base_area: mainBaseSF || null,
    finished_upper_story_area: finished_upper_story_area,

    // Required by schema (allow nulls per schema definitions)
    architectural_style_type: null,
    attachment_type: attachmentType,
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

  return structure;
}

function countStructureExtras($) {
  let count = 0;
  $("#parcelDetails_XFOBTable tr[bgcolor]").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const code = $(tds[0]).text().trim();
    if (!code) return;
    const rawDesc = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const analysis = analyzeFeature(code, rawDesc);
    if (analysis.target === "structure") count += 1;
  });
  return count;
}

function main() {
  const html = readInputHtml();
  if (!html) {
    process.exit(0);
  }
  const $ = cheerio.load(html);
  const extraStructureCount = countStructureExtras($);
  const parcelId = extractParcelId($);
  const bldg = extractBuildingData($);
  const structure = buildStructureObject({
    ...bldg,
    extraStructureCount,
  });

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "structure_data.json");

  const out = {};
  out[`property_${parcelId}`] = structure;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}
