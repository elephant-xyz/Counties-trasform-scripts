const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}
function removeFileIfExists(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}
function cleanText(s) {
  if (s == null) return null;
  return String(s).replace(/\s+/g, " ").trim();
}
function parseCurrencyToNumber(s) {
  if (s == null) return null;
  const cleaned = String(s).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}
function toISODate(mdyyyy) {
  if (!mdyyyy) return null;
  const parts = mdyyyy.split("/").map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}
function titleCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.replace(
    /\b([a-z])(\w*)/g,
    (m, a, rest) => a.toUpperCase() + rest,
  );
}
function extractParcelIdFromH1($) {
  const h1 = $("h1").first().text();
  const m = h1.match(/(\d{12})/);
  return m ? m[1] : null;
}

const MANUFACTURED_HOME_CODES = new Set(["0200", "0201", "0204", "0205"]);
const UNIT_CODES = new Set([
  "0400",
  "0401",
  "0403",
  "0404",
  "0405",
  "1104",
  "1105",
  "1202",
  "1203",
  "1906",
  "1907",
  "2003",
  "4801",
  "4802",
]);
const LAND_PARCEL_CODES = new Set([
  "2800",
  "2801",
  "3500",
  "3600",
  "3700",
  "3800",
  "4800",
  "4900",
  "4901",
  "4902",
  "4903",
  "4904",
  "4905",
  "5000",
  "5001",
  "5002",
  "5003",
  "5004",
  "8200",
]);
const RESIDENTIAL_CODES = new Set([
  "0100",
  "0101",
  "0102",
  "0105",
  "0106",
  "0108",
  "0300",
  "0600",
  "0601",
  "0700",
  "0701",
  "0800",
  "0801",
  "0802",
  "0803",
  "0804",
  "0805",
  "0806",
  "0807",
  "0810",
  "0813",
  "0814",
  "0815",
  "3901",
  "5000",
  "5001",
  "5002",
  "5003",
  "5004",
]);
const RESIDENTIAL_COMMON_ELEMENT_CODES = new Set(["0902", "0908"]);
const CONDO_USAGE_CODES = new Set([
  "0400",
  "0401",
  "0403",
  "0404",
  "0405",
  "1104",
  "1105",
  "1202",
  "1906",
  "1907",
  "2003",
  "4801",
  "4802",
]);
const COMMERCIAL_CODES = new Set([
  "1100",
  "1101",
  "1102",
  "1103",
  "1110",
  "1170",
  "1178",
  "1198",
  "1199",
  "1200",
  "1201",
  "1203",
  "1300",
  "1301",
  "1302",
  "1400",
  "1401",
  "1402",
  "1500",
  "1600",
  "1601",
  "1602",
  "1700",
  "1701",
  "1702",
  "1800",
  "1801",
  "1802",
  "1803",
  "1900",
  "1901",
  "1902",
  "1903",
  "1904",
  "1905",
  "2000",
  "2001",
  "2002",
  "2100",
  "2200",
  "2300",
  "2400",
  "2500",
  "2501",
  "2600",
  "2601",
  "2700",
  "2800",
  "2801",
  "2802",
  "2803",
  "2804",
  "2805",
  "2806",
  "2807",
  "2808",
  "2900",
  "3000",
  "3100",
  "3200",
  "3300",
  "3400",
  "3409",
  "3410",
  "3500",
  "3501",
  "3502",
  "3503",
  "3504",
  "3505",
  "3600",
  "3700",
  "3800",
  "3801",
  "3802",
  "3803",
  "3804",
  "3805",
  "3900",
  "4100",
  "4200",
  "4300",
  "4400",
  "4500",
  "4600",
  "4700",
  "4800",
  "4810",
  "4900",
  "4901",
  "4902",
  "4903",
  "4904",
  "4905",
  "7100",
  "7200",
  "7300",
  "7400",
  "7500",
  "7600",
  "7601",
  "7800",
  "7900",
  "8100",
  "8200",
  "8300",
  "8301",
  "8302",
  "8305",
  "8400",
  "8405",
  "8500",
  "8600",
  "8700",
  "8800",
  "8900",
  "9100",
]);
const PROPERTY_USAGE_SPECIAL_BY_CODE = {
  "7100": "Church",
  "7200": "PrivateSchool",
  "7300": "PrivateHospital",
  "7400": "Retirement",
  "7500": "NonProfitCharity",
  "7600": "MortuaryCemetery",
  "7601": "MortuaryCemetery",
  "7800": "SanitariumConvalescentHome",
  "7900": "CulturalOrganization",
  "8100": "Military",
  "8200": "ForestParkRecreation",
  "8300": "PublicSchool",
  "8301": "PublicSchool",
  "8302": "PublicSchool",
  "8305": "PublicSchool",
};

function mapPropertyTypeFromCode(code, contextForError) {
  if (!code) return null;
  const normalized = String(code).replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  if (LAND_PARCEL_CODES.has(normalized)) return "LandParcel";
  if (MANUFACTURED_HOME_CODES.has(normalized)) return "ManufacturedHome";
  if (UNIT_CODES.has(normalized)) return "Unit";
  return "Building";
}

function mapPropertyUsageType(buildingUseText, code) {
  const normalizedCode = code
    ? String(code).replace(/\D/g, "").padStart(4, "0").slice(0, 4)
    : null;
  const raw = (buildingUseText || "").toLowerCase();
  if (normalizedCode) {
    if (PROPERTY_USAGE_SPECIAL_BY_CODE[normalizedCode])
      return PROPERTY_USAGE_SPECIAL_BY_CODE[normalizedCode];
    if (RESIDENTIAL_COMMON_ELEMENT_CODES.has(normalizedCode))
      return "ResidentialCommonElementsAreas";
    if (
      RESIDENTIAL_CODES.has(normalizedCode) ||
      CONDO_USAGE_CODES.has(normalizedCode) ||
      MANUFACTURED_HOME_CODES.has(normalizedCode)
    )
      return "Residential";
    if (COMMERCIAL_CODES.has(normalizedCode)) return "Commercial";
    if (LAND_PARCEL_CODES.has(normalizedCode)) return null;
  }
  if (!raw && normalizedCode) {
    if (MANUFACTURED_HOME_CODES.has(normalizedCode)) return "Residential";
    if (LAND_PARCEL_CODES.has(normalizedCode)) return null;
  }
  if (/common\s+element|common\s+area/.test(raw))
    return "ResidentialCommonElementsAreas";
  if (/(retire|assisted|senior|alcf|care)/.test(raw)) return "Retirement";
  if (/(church|chapel|synagogue|temple)/.test(raw)) return "Church";
  if (/(school)/.test(raw)) return /public/.test(raw) ? "PublicSchool" : "PrivateSchool";
  if (/(hospital|clinic|medical)/.test(raw))
    return /public/.test(raw) ? "PublicHospital" : "PrivateHospital";
  if (/(cemetery|mortuary|funeral|mausoleum|crypt)/.test(raw))
    return "MortuaryCemetery";
  if (/(golf|park|recreation|recreational|forest)/.test(raw))
    return "ForestParkRecreation";
  if (/(bank|savings|credit union|financial)/.test(raw))
    return "FinancialInstitution";
  if (/(warehouse)/.test(raw)) return "Warehouse";
  if (/(gas station|service station|fuel|petrol)/.test(raw))
    return "ServiceStation";
  if (
    /(store|retail|commercial|shopping|office|restaurant|bar|lounge|hotel|motel|auto|garage|dealership|factory|plant|industrial|terminal)/.test(
      raw,
    )
  )
    return "Commercial";
  if (
    /(mobile home|manufactured|single family|residential|duplex|triplex|quad|multi|condo|townhouse|apartment|zero lot)/.test(
      raw,
    )
  )
    return "Residential";
  if (MANUFACTURED_HOME_CODES.has(normalizedCode || "")) return "Residential";
  return null;
}

function extractProperty($) {
  const parcelId = extractParcelIdFromH1($);
  let zoning = null;
  $("div.w3-row.w3-border.w3-border-blue").each((_, el) => {
    const label = $(el)
      .find("div.w3-cell.w3-half strong")
      .first()
      .text()
      .trim();
    if (/Zoning Code/i.test(label))
      zoning = cleanText($(el).find("div.w3-cell.w3-half").last().text());
  });
  let longLegal = null;
  $("div.w3-cell-row div.w3-container").each((_, el) => {
    const strongText = $(el).find("strong").first().text().trim();
    if (/Long Legal/i.test(strongText))
      longLegal = cleanText(
        $(el)
          .text()
          .replace(/Long Legal:\s*/i, ""),
      );
  });
  let yearBuilt = null,
    acArea = null,
    totalArea = null,
    propertyType = null,
    floors = null,
    buildingUseText = null,
    buildingUseCode = null;
  const bldTable = $(
    "table.prctable caption.blockcaption:contains('Building Information')",
  ).closest("table");
  if (bldTable && bldTable.length) {
    const firstRow = bldTable.find("tbody tr").eq(1);
    if (firstRow && firstRow.length) {
      const cells = firstRow.find("td");
      buildingUseText = cleanText($(cells.get(3)).text());
      buildingUseCode = buildingUseText
        ? buildingUseText.replace(/[^0-9]/g, "")
        : null;
      if (buildingUseCode)
        propertyType = mapPropertyTypeFromCode(buildingUseCode, "property");
      yearBuilt = parseInt(cleanText($(cells.get(4)).text()), 10) || null;
      floors = parseFloat(cleanText($(cells.get(6)).text())) || null;
      let rawArea = cleanText($(cells.get(11)).text());
      acArea = rawArea.length >= 2 ? rawArea : rawArea.length === 1 ? "0" + rawArea : null;
      totalArea = cleanText($(cells.get(12)).text());
    }
  }
  let effectiveYear = null;
  if (bldTable && bldTable.length) {
    const firstRow = bldTable.find("tbody tr").eq(1);
    if (firstRow && firstRow.length) {
      const cells = firstRow.find("td");
      effectiveYear = parseInt(cleanText($(cells.get(5)).text()), 10) || null;
    }
  }
  const property = {
    parcel_identifier: parcelId || "",
    property_type: propertyType || null,
    property_structure_built_year: yearBuilt || null,
    property_legal_description_text: longLegal || null,
    livable_floor_area: acArea ? String(acArea) : null,
    area_under_air: acArea ? String(acArea) : null,
    total_area: totalArea ? String(totalArea) : null,
    zoning: zoning || null,
    property_effective_built_year: effectiveYear || null,
    build_status: propertyType
      ? propertyType === "LandParcel"
        ? "VacantLand"
        : "Improved"
      : null,
    historic_designation: false,
    property_usage_type: mapPropertyUsageType(buildingUseText, buildingUseCode),
  };
  return { property, floors, acArea, totalArea };
}

function extractLandValue($) {
  const landTable = $(
    "table.prctable caption.blockcaption:contains('Land Information')",
  ).closest("table");
  if (landTable && landTable.length) {
    const firstRow = landTable.find("tbody tr").eq(1);
    if (firstRow && firstRow.length) {
      const landValCell = firstRow.find("td").last();
      const val = parseCurrencyToNumber(landValCell.text());
      return val;
    }
  }
  return null;
}

function extractTax($) {
  const taxTable = $(
    "table.prctable caption.blockcaption:contains('Preliminary Tax Roll Values')",
  ).closest("table");
  if (!taxTable.length) return null;
  const captionText = taxTable.find("caption.blockcaption").first().text();
  let yearMatch =
    captionText.match(/(\d{4})\s+Preliminary/i) || captionText.match(/(\d{4})/);
  const taxYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
  let market = null,
    assessed = null,
    taxable = null;
  const rows = taxTable.find("tbody tr");
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    const label = cleanText($(tds.get(0)).text());
    const countyVal = cleanText($(tds.get(1)).text());
    if (/Just Value/i.test(label)) market = parseCurrencyToNumber(countyVal);
    else if (/Assessed Value/i.test(label))
      assessed = parseCurrencyToNumber(countyVal);
    else if (/Taxable Value/i.test(label))
      taxable = parseCurrencyToNumber(countyVal);
  });
  const landAmount = extractLandValue($);
  return {
    tax_year: taxYear,
    property_assessed_value_amount: assessed,
    property_market_value_amount: market,
    property_taxable_value_amount: taxable,
    property_land_amount: landAmount,
    property_building_amount:
      market != null && landAmount != null ? Math.max(market - landAmount, 0) : null,
  };
}

function getOwnerType(ownerName) {
  if (!ownerName) return "unknown";
  const norm = ownerName.toUpperCase().trim();
  if (/LLC|CORP|INC|COMPANY|CO\.|TRUST|TTEE|L P |L P$|LP$|HOLDINGS|ASSOC|ASSOCIATION|BANK|PARTNERSHIP|INVESTMENTS|MORTGAGE|LENDING|CAPITAL|SAVINGS|CREDIT|ESTATE|PROPERTY|PROPERTIES|VENTURES|FUND|BOARD|HOA|HOMEOWNERS ASSOCIATION/.test(norm))
    return "company";
  if (/,/.test(norm)) return "person";
  const words = norm.split(/\s+/);
  const hasFirst =
    words.length >= 2 && /^[A-Z][A-Z]+$/.test(words[0]) && /^[A-Z][A-Z]+$/.test(words[1]);
  if (hasFirst) return "person";
  return "company";
}

function cleanOwnerName(name) {
  if (!name) return null;
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (/^ET\s+AL$/i.test(cleaned)) return "Et Al";
  return cleaned;
}

function extractOwners($) {
  const table = $(
    "table.prctable caption.blockcaption:contains('Owner Information')",
  ).closest("table");
  if (!table.length) return [];
  const owners = [];
  table.find("tbody tr").each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const ownerName = cleanText($(tds.get(0)).text());
    const mailingAddress1 = cleanText($(tds.get(1)).text());
    const mailingAddress2 = cleanText($(tds.get(2)).text());
    const mailingAddress3 = cleanText($(tds.get(3)).text());
    const owner = {
      owner_name: ownerName,
      mailing_address_1: mailingAddress1,
      mailing_address_2: mailingAddress2,
      mailing_address_3: mailingAddress3,
    };
    owners.push(owner);
  });
  return owners;
}

function buildOwners(ownersPath, parcelId, dataDir) {
  try {
    const ownersData = readJSON(ownersPath);
    if (!ownersData || !Array.isArray(ownersData)) return { files: [] };
    const ownerFiles = [];
    const ownerType = ownersData.length
      ? getOwnerType(cleanOwnerName(ownersData[0].owner_name))
      : "person";
    ownersData.forEach((owner, idx) => {
      const fileName =
        ownerType === "person"
          ? `person_${idx + 1}.json`
          : `company_${idx + 1}.json`;
      writeJSON(path.join(dataDir, fileName), owner);
      if (parcelId) {
        const rel = {
          from: { "/": `./${fileName}` },
          to: { "/": "./property.json" },
        };
        const relName =
          ownerType === "person"
            ? `relationship_person_${idx + 1}_to_property.json`
            : `relationship_company_${idx + 1}_to_property.json`;
        writeJSON(path.join(dataDir, relName), rel);
      }
      ownerFiles.push(fileName);
    });
    return { files: ownerFiles, type: ownerType };
  } catch (err) {
    return { files: [] };
  }
}

function extractSales($) {
  const salesTable = $(
    "table.prctable caption.blockcaption:contains('Sales Information')",
  ).closest("table");
  const sales = [];
  if (!salesTable.length) return sales;
  const rows = salesTable.find("tbody tr");
  rows.each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find("td");
    if (!tds.length) return;
    const saleDate = cleanText($(tds.get(0)).text());
    const salePrice = parseCurrencyToNumber($(tds.get(1)).text());
    const saleQual = cleanText($(tds.get(2)).text());
    const saleGrantor = cleanText($(tds.get(3)).text());
    const saleGrantee = cleanText($(tds.get(4)).text());
    const saleInstrument = cleanText($(tds.get(5)).text());
    const sale = {
      sale_date: toISODate(saleDate),
      sale_price_amount: salePrice,
      sale_qualification: saleQual || null,
      grantor: saleGrantor || null,
      grantee: saleGrantee || null,
      instrument: saleInstrument || null,
    };
    sales.push(sale);
  });
  return sales;
}

function parseLinksFromDocTable($) {
  const docTable = $(
    "table.prctable caption.blockcaption:contains('Document Links')",
  ).closest("table");
  const links = [];
  if (!docTable.length) return links;
  docTable.find("tbody tr").each((idx, tr) => {
    if (idx === 0) return;
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const name = cleanText($(tds.get(0)).text());
    const anchor = $(tds.get(1)).find("a").first();
    if (!anchor || !anchor.length) return;
    const href = anchor.attr("href");
    if (!href) return;
    links.push({ name, url: href, type: name });
  });
  return links;
}

function docTypeFromLinkType(name) {
  if (!name) return null;
  const norm = name.toUpperCase();
  if (norm.includes("DEED")) return "Deed";
  if (norm.includes("MORTGAGE")) return "Mortgage";
  if (norm.includes("LIEN")) return "Lien";
  if (norm.includes("NOTICE")) return "Notice";
  if (norm.includes("MAP")) return "Map";
  return null;
}

function guessFileFormatFromUrl(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes(".pdf")) return "PDF";
  if (lower.includes(".tif") || lower.includes(".tiff")) return "TIFF";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "JPEG";
  if (lower.includes(".png")) return "PNG";
  return null;
}

function extractStructure($, defaults) {
  const bldTable = $(
    "table.prctable caption.blockcaption:contains('Building Information')",
  ).closest("table");
  let floors = defaults && defaults.floors ? defaults.floors : null;
  let baseArea = null;
  let acArea =
    defaults && defaults.acArea ? parseInt(defaults.acArea, 10) || null : null;
  let yearBuilt = null;
  let yearCond = null;
  if (bldTable && bldTable.length) {
    const row = bldTable.find("tbody tr").eq(1);
    if (row && row.length) {
      const tds = row.find("td");
      yearBuilt = parseInt(cleanText($(tds.get(4)).text()), 10) || null;
      yearCond = parseInt(cleanText($(tds.get(5)).text()), 10) || null;
      floors =
        floors != null ? floors : parseFloat(cleanText($(tds.get(6)).text())) || null;
      const baseText = cleanText($(tds.get(10)).text());
      baseArea = baseText ? parseInt(baseText.replace(/[^0-9]/g, ""), 10) || null : null;
      if (acArea == null) {
        const acText = cleanText($(tds.get(11)).text());
        acArea = acText ? parseInt(acText.replace(/[^0-9]/g, ""), 10) || null : null;
      }
    }
  }
  const propertyTypeFromDefaults =
    defaults && defaults.propertyType ? defaults.propertyType : null;
  const structure = {
    architectural_style_type: null,
    attachment_type:
      propertyTypeFromDefaults === "Unit"
        ? "Attached"
        : propertyTypeFromDefaults === "LandParcel"
          ? null
          : "Detached",
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: baseArea != null ? Number(baseArea) : acArea != null ? Number(acArea) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_buildings: 1,
    number_of_stories: floors != null ? Number(floors) : null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  const componentTable = $(
    "table.prctable caption.blockcaption:contains('Building Component Information')",
  ).closest("table");
  if (componentTable && componentTable.length) {
    componentTable.find("tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;
      const desc = cleanText($(tds).eq(2).text()).toLowerCase();
      if (!desc) return;
      if (desc.includes("masonry") && desc.includes("stucco")) {
        structure.exterior_wall_material_primary = "Stucco";
        structure.primary_framing_material = "Concrete Block";
      }
      if (desc.includes("clay tile") || desc.includes("concrete tile")) {
        structure.roof_covering_material = "Concrete Tile";
        structure.roof_material_type = "Tile";
      }
      if (desc.includes("shingle")) {
        structure.roof_covering_material =
          structure.roof_covering_material || "Asphalt Shingle";
        structure.roof_material_type = structure.roof_material_type || "Shingle";
      }
      if (desc.includes("slab on grade")) {
        structure.foundation_type = "Slab on Grade";
        structure.foundation_material = "Poured Concrete";
        structure.subfloor_material = "Concrete Slab";
      }
      if (desc.includes("plaster interior")) {
        structure.interior_wall_surface_material_primary = "Plaster";
      }
      if (desc.includes("impact window")) {
        structure.window_glazing_type = "Impact Resistant";
      }
    });
  }
  return structure;
}

function extractLot($) {
  const tbl = $(
    "table.prctable caption.blockcaption:contains('Land Information')",
  ).closest("table");
  if (!tbl.length) return {};
  const row = tbl.find("tbody tr").eq(1);
  if (!row.length) return {};
  const tds = row.find("td");
  const landUnits = cleanText($(tds.get(2)).text());
  const rawUnitType = cleanText($(tds.get(3)).text());
  const unitType = rawUnitType ? rawUnitType.toUpperCase() : "";
  const depth = cleanText($(tds.get(4)).text());
  const frontage = cleanText($(tds.get(5)).text());

  const toNumber = (value) => {
    if (!value) return null;
    const num = parseFloat(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) ? num : null;
  };

  const lotLengthFeet = toNumber(depth);
  const lotWidthFeet = toNumber(frontage);
  const lotUnitsNumeric = toNumber(landUnits);
  let lotAreaSqft = null;
  let lotSizeAcre = null;
  if (lotUnitsNumeric != null) {
    if (/ACR?E/.test(unitType) || /\bAC\b/.test(unitType)) {
      lotSizeAcre = lotUnitsNumeric;
    } else if (/SQ\s*FT|SQUARE\s+FEET|SQUARE\s+FOOT|SQFT/.test(unitType)) {
      lotAreaSqft = lotUnitsNumeric;
    }
  }
  let view = null;
  $("div.w3-row .w3-cell.w3-half").each((_, el) => {
    const strong = $(el).find("strong").first().text().trim();
    if (/Waterfront:/i.test(strong)) {
      const rowEl = $(el).closest(".w3-row");
      const cells = rowEl.find(".w3-cell.w3-half");
      if (cells.length >= 2) {
        const value = cleanText($(cells[1]).text()).toUpperCase();
        if (value.includes("YES")) view = "Waterfront";
      }
    }
  });

  return {
    lot_type: null,
    lot_length_feet: lotLengthFeet,
    lot_width_feet: lotWidthFeet,
    lot_area_sqft: lotAreaSqft,
    lot_size_acre: lotSizeAcre,
    landscaping_features: null,
    view,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
}

function buildUtilities(
  pathToOwnersUtilities,
  parcelId,
  dataDir,
  sharedSourceHttpRequest,
  sharedRequestIdentifier,
) {
  try {
    const rawUtilities = readJSON(pathToOwnersUtilities);
    if (!rawUtilities) return;
    const key = parcelId ? `property_${parcelId}` : null;
    const utilRecord =
      (key && rawUtilities[key]) ||
      (!Array.isArray(rawUtilities) && rawUtilities);
    if (!utilRecord || typeof utilRecord !== "object") return;
    const utilities = { ...utilRecord };
    if (sharedSourceHttpRequest)
      utilities.source_http_request = sharedSourceHttpRequest;
    if (sharedRequestIdentifier)
      utilities.request_identifier = sharedRequestIdentifier;
    writeJSON(path.join(dataDir, "utility.json"), utilities);
    if (parcelId) {
      const rel = {
        from: { "/": "./utility.json" },
        to: { "/": "./property.json" },
      };
      writeJSON(path.join(dataDir, "relationship_utility_to_property.json"), rel);
    }
  } catch {}
}

function buildLayouts(layoutPath, parcelId, dataDir) {
  try {
    const layouts = readJSON(layoutPath);
    if (!layouts || !Array.isArray(layouts)) return;
    layouts.forEach((layout, idx) => {
      const fileName = `layout_${idx + 1}.json`;
      writeJSON(path.join(dataDir, fileName), layout);
      if (parcelId) {
        const rel = {
          from: { "/": `./${fileName}` },
          to: { "/": "./property.json" },
        };
        const relName = `relationship_layout_${idx + 1}_to_property.json`;
        writeJSON(path.join(dataDir, relName), rel);
      }
    });
  } catch {}
}

function buildAddressOutput(srcPath, destPath) {
  const address = readJSON(srcPath);
  if (!address) throw new Error("address missing");
  writeJSON(destPath, address);
}

function docLinksBySale(links, sales) {
  const perSale = new Map();
  if (!links || !links.length || !sales || !sales.length) return perSale;
  sales.forEach((sale, idx) => {
    perSale.set(idx, []);
    const saleDate = sale.sale_date ? sale.sale_date.replace(/-/g, "") : null;
    links.forEach((link) => {
      const name = link.name || "";
      if (saleDate && name.includes(saleDate)) {
        perSale.get(idx).push(link);
      }
    });
  });
  return perSale;
}

function buildDeedsAndFiles($, dataDir, sales) {
  const links = parseLinksFromDocTable($);
  if (!links.length) return;
  const perSaleLinks = docLinksBySale(links, sales.map((s) => s.data));
  let deedIdx = 0;
  let fileIdx = 0;
  const remainingLinks = [...links];
  perSaleLinks.forEach((saleLinks, idx) => {
    const saleFile = sales[idx].file;
    saleLinks.forEach((lk) => {
      remainingLinks.splice(
        remainingLinks.findIndex((l) => l.url === lk.url),
        1,
      );
      deedIdx += 1;
      const deedFile = `deed_${deedIdx}.json`;
      const deedObj = {
        document_recording_identifier: lk.name || null,
        document_recording_date: null,
        document_type: docTypeFromLinkType(lk.type),
        instrument_number: null,
        document_book: null,
        document_page: null,
        original_url: lk.url || null,
      };
      writeJSON(path.join(dataDir, deedFile), deedObj);
      const relSalesDeed = {
        from: { "/": `./${saleFile}` },
        to: { "/": `./${deedFile}` },
      };
      writeJSON(
        path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`),
        relSalesDeed,
      );
      fileIdx += 1;
      const fileObj = {
        document_type: docTypeFromLinkType(lk.type),
        file_format: guessFileFormatFromUrl(lk.url),
        ipfs_url: null,
        name: lk.name || null,
        original_url: lk.url || null,
      };
      writeJSON(path.join(dataDir, `file_${fileIdx}.json`), fileObj);
      const relDF = {
        to: { "/": `./deed_${deedIdx}.json` },
        from: { "/": `./file_${fileIdx}.json` },
      };
      writeJSON(
        path.join(dataDir, `relationship_deed_file_${fileIdx}.json`),
        relDF,
      );
    });
  });
  remainingLinks.forEach((lk) => {
    deedIdx += 1;
    const deedFile = `deed_${deedIdx}.json`;
    const deedObj = {
      document_recording_identifier: lk.name || null,
      document_recording_date: null,
      document_type: docTypeFromLinkType(lk.type),
      instrument_number: null,
      document_book: null,
      document_page: null,
      original_url: lk.url || null,
    };
    writeJSON(path.join(dataDir, deedFile), deedObj);
    fileIdx += 1;
    const fileObj = {
      document_type: docTypeFromLinkType(lk.type),
      file_format: guessFileFormatFromUrl(lk.url),
      ipfs_url: null,
      name: lk.name || null,
      original_url: lk.url || null,
    };
    writeJSON(path.join(dataDir, `file_${fileIdx}.json`), fileObj);
    const relDF = {
      to: { "/": `./deed_${deedIdx}.json` },
      from: { "/": `./file_${fileIdx}.json` },
    };
    writeJSON(
      path.join(dataDir, `relationship_deed_file_${fileIdx}.json`),
      relDF,
    );
  });
}

function cleanupLegacy(dataDir) {
  const files = fs.readdirSync(dataDir);
  files.forEach((f) => {
    if (/^file_\d+\.json$/.test(f)) removeFileIfExists(path.join(dataDir, f));
    if (/^relationship_deed_file_\d+\.json$/.test(f))
      removeFileIfExists(path.join(dataDir, f));
  });
  removeFileIfExists(path.join(dataDir, "relationship_sales_person.json"));
  removeFileIfExists(path.join(dataDir, "relationship_sales_company.json"));
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  cleanupLegacy(dataDir);
  const html = readText("input.html");
  const $ = cheerio.load(html);
  const parcelMeta = readJSON("parcel.json");
  const parcelIdFromParcel =
    parcelMeta && parcelMeta.parcel_identifier
      ? parcelMeta.parcel_identifier
      : null;
  const parcelId = extractParcelIdFromH1($) || parcelIdFromParcel;
  const sharedSourceHttpRequest =
    parcelMeta && parcelMeta.source_http_request
      ? parcelMeta.source_http_request
      : null;
  const sharedRequestIdentifier =
    parcelMeta && parcelMeta.request_identifier
      ? parcelMeta.request_identifier
      : parcelId;
  try {
    buildAddressOutput("address.json", path.join(dataDir, "address.json"));
  } catch {}
  const { property, floors, acArea, totalArea } = extractProperty($);
  property.parcel_identifier = parcelId || property.parcel_identifier;
  if (!property.parcel_identifier) throw new Error("parcel_identifier missing");
  if (sharedSourceHttpRequest) property.source_http_request = sharedSourceHttpRequest;
  if (sharedRequestIdentifier) property.request_identifier = sharedRequestIdentifier;
  writeJSON(path.join(dataDir, "property.json"), property);
  const tax = extractTax($);
  if (tax && tax.tax_year)
    writeJSON(path.join(dataDir, `tax_${tax.tax_year}.json`), {
      ...tax,
      ...(sharedSourceHttpRequest ? { source_http_request: sharedSourceHttpRequest } : {}),
      ...(sharedRequestIdentifier ? { request_identifier: sharedRequestIdentifier } : {}),
    });
  const sales = extractSales($);
  const salesFiles = [];
  sales.forEach((s, idx) => {
    const fn = path.join(dataDir, `sales_${idx + 1}.json`);
    const { links, ...salesData } = s;
    const saleOut = {
      ...salesData,
      ...(sharedSourceHttpRequest ? { source_http_request: sharedSourceHttpRequest } : {}),
      ...(sharedRequestIdentifier ? { request_identifier: sharedRequestIdentifier } : {}),
    };
    writeJSON(fn, saleOut);
    salesFiles.push({ file: `sales_${idx + 1}.json`, data: s });
  });
  const ownersRes = buildOwners(
    path.join("owners", "owner_data.json"),
    parcelId,
    dataDir,
  );
  if (ownersRes.type && ownersRes.files.length && salesFiles.length) {
    salesFiles.forEach((s, sIdx) => {
      if (ownersRes.type === "person") {
        ownersRes.files.forEach((pf, i) => {
          const rel = { to: { "/": `./${pf}` }, from: { "/": `./${s.file}` } };
          writeJSON(
            path.join(
              dataDir,
              `relationship_sales_person_${sIdx + 1}_${i + 1}.json`,
            ),
            rel,
          );
        });
      } else if (ownersRes.type === "company") {
        ownersRes.files.forEach((cf, i) => {
          const rel = { to: { "/": `./${cf}` }, from: { "/": `./${s.file}` } };
          writeJSON(
            path.join(
              dataDir,
              `relationship_sales_company_${sIdx + 1}_${i + 1}.json`,
            ),
            rel,
          );
        });
      }
    });
  }
  try {
    buildUtilities(
      path.join("owners", "utilities_data.json"),
      parcelId,
      dataDir,
      sharedSourceHttpRequest,
      sharedRequestIdentifier,
    );
  } catch {}
  try {
    buildLayouts(path.join("owners", "layout_data.json"), parcelId, dataDir);
  } catch {}
  try {
    const structure = extractStructure($, {
      floors,
      acArea,
      totalArea,
      propertyType: property.property_type,
    });
    if (structure) {
      if (sharedSourceHttpRequest)
        structure.source_http_request = sharedSourceHttpRequest;
      if (sharedRequestIdentifier)
        structure.request_identifier = sharedRequestIdentifier;
      writeJSON(path.join(dataDir, "structure.json"), structure);
    }
  } catch {}
  try {
    const lot = extractLot($);
    if (lot) {
      if (sharedSourceHttpRequest)
        lot.source_http_request = sharedSourceHttpRequest;
      if (sharedRequestIdentifier)
        lot.request_identifier = sharedRequestIdentifier;
      writeJSON(path.join(dataDir, "lot.json"), lot);
    }
  } catch {}
  try {
    buildDeedsAndFiles($, dataDir, salesFiles);
  } catch {}
}

try {
  main();
  console.log("Extraction complete.");
} catch (err) {
  try {
    const obj = JSON.parse(err.message);
    console.error(JSON.stringify(obj));
    process.exit(1);
  } catch (e) {
    console.error(err.stack || String(err));
    process.exit(1);
  }
}
