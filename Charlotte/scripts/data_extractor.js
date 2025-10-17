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

// Property type lookup generated from charlotte_property_types.txt (2025-10-17)
const PROPERTY_TYPE_LOOKUP = {
  "0100": "SingleFamily",
  "0101": "SingleFamily",
  "0102": "SingleFamily",
  "0105": "SingleFamily",
  "0106": "Modular",
  "0108": "SingleFamily",
  "0200": "MobileHome",
  "0201": "MobileHome",
  "0204": "MobileHome",
  "0205": "ManufacturedHome",
  "0300": "MultiFamilyMoreThan10",
  "0400": "Condominium",
  "0401": "Condominium",
  "0403": "DetachedCondominium",
  "0404": "Condominium",
  "0405": "Condominium",
  "0600": "Retirement",
  "0601": "Retirement",
  "0700": "MiscellaneousResidential",
  "0701": "MiscellaneousResidential",
  "0800": "Duplex",
  "0801": "3Units",
  "0802": "4Units",
  "0803": "MultiFamilyLessThan10",
  "0804": "MultiFamilyLessThan10",
  "0805": "MultiFamilyLessThan10",
  "0806": "MultiFamilyLessThan10",
  "0807": "MultiFamilyLessThan10",
  "0810": "MultiFamilyMoreThan10",
  "0813": "Duplex",
  "0814": "MultiFamilyLessThan10",
  "0815": "MultiFamilyLessThan10",
  "0902": "ResidentialCommonElementsAreas",
  "0908": "ResidentialCommonElementsAreas",
  "1100": "Building",
  "1101": "Building",
  "1102": "Building",
  "1103": "Building",
  "1104": "Condominium",
  "1105": "Condominium",
  "1110": "Building",
  "1170": "Building",
  "1178": "Building",
  "1198": "Building",
  "1199": "Building",
  "1200": "Building",
  "1201": "Building",
  "1202": "Condominium",
  "1203": "Condominium",
  "1300": "Building",
  "1301": "Building",
  "1302": "Building",
  "1400": "Building",
  "1401": "Building",
  "1402": "Building",
  "1500": "Building",
  "1600": "Building",
  "1601": "Building",
  "1602": "Building",
  "1700": "Building",
  "1701": "Building",
  "1702": "Building",
  "1800": "Building",
  "1801": "Building",
  "1802": "Building",
  "1803": "Building",
  "1900": "Building",
  "1901": "Building",
  "1902": "Building",
  "1903": "Building",
  "1904": "Building",
  "1905": "Building",
  "1906": "Condominium",
  "1907": "Condominium",
  "2000": "Building",
  "2001": "Building",
  "2002": "Building",
  "2003": "Condominium",
  "2100": "Building",
  "2200": "Building",
  "2300": "Building",
  "2400": "Building",
  "2500": "Building",
  "2501": "Building",
  "2600": "Building",
  "2601": "Building",
  "2700": "Building",
  "2800": "LandParcel",
  "2801": "LandParcel",
  "2802": "Building",
  "2803": "Building",
  "2804": "Building",
  "2805": "Building",
  "2806": "Building",
  "2807": "Building",
  "2808": "Building",
  "2900": "Building",
  "3000": "Building",
  "3100": "Building",
  "3200": "Building",
  "3300": "Building",
  "3400": "Building",
  "3409": "Modular",
  "3410": "Modular",
  "3500": "LandParcel",
  "3501": "Building",
  "3502": "Building",
  "3503": "Building",
  "3504": "Building",
  "3505": "Building",
  "3600": "LandParcel",
  "3700": "LandParcel",
  "3800": "LandParcel",
  "3801": "Building",
  "3802": "Building",
  "3803": "Building",
  "3804": "Building",
  "3805": "Building",
  "3900": "Building",
  "3901": "Timeshare",
  "4100": "Building",
  "4200": "Building",
  "4300": "LandParcel",
  "4400": "Building",
  "4500": "Building",
  "4600": "Building",
  "4700": "Building",
  "4800": "LandParcel",
  "4801": "Condominium",
  "4802": "Condominium",
  "4810": "Building",
  "4900": "LandParcel",
  "4901": "LandParcel",
  "4902": "LandParcel",
  "4903": "LandParcel",
  "4904": "LandParcel",
  "4905": "LandParcel",
  "5000": "LandParcel",
  "5001": "LandParcel",
  "5002": "LandParcel",
  "5003": "LandParcel",
  "5004": "LandParcel",
  "7100": "Building",
  "7200": "Building",
  "7300": "Building",
  "7400": "Retirement",
  "7500": "Building",
  "7600": "Building",
  "7601": "Building",
  "7700": "Building",
  "7800": "Retirement",
  "7900": "Building",
  "8100": "Building",
  "8200": "LandParcel",
  "8300": "Building",
  "8301": "Building",
  "8302": "Building",
  "8305": "Building",
  "8400": "Building",
  "8405": "Building",
  "8500": "Building",
  "8600": "Building",
  "8700": "Building",
  "8800": "Building",
  "8900": "Building",
  "9100": "Building",
};

function mapPropertyTypeFromCode(code, contextForError) {
  if (!code) return null;
  const normalized = String(code).replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  const val = PROPERTY_TYPE_LOOKUP[normalized];
  if (val) return val;
  const err = {
    type: "error",
    message: `Unknown enum value ${code}.`,
    path: `${contextForError}.property_type`,
  };
  throw new Error(JSON.stringify(err));
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
    floors = null;
  const bldTable = $(
    "table.prctable caption.blockcaption:contains('Building Information')",
  ).closest("table");
  if (bldTable && bldTable.length) {
    const firstRow = bldTable.find("tbody tr").eq(1);
    if (firstRow && firstRow.length) {
      const cells = firstRow.find("td");
      const buildingUse = cleanText($(cells.get(3)).text());
      const buildingUseCode = buildingUse
        ? buildingUse.replace(/[^0-9]/g, "")
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
    build_status: null,
    historic_designation: false,
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
    property_land_value_amount: landAmount,
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
  let acArea =
    defaults && defaults.acArea ? parseInt(defaults.acArea, 10) || null : null;
  let totalArea =
    defaults && defaults.totalArea ? parseInt(defaults.totalArea, 10) || null : null;
  let yearBuilt = null;
  let yearCond = null;
  let buildingUse = null;
  let buildingNumber = null;
  let quality = null;
  if (bldTable && bldTable.length) {
    const row = bldTable.find("tbody tr").eq(1);
    if (row && row.length) {
      const tds = row.find("td");
      buildingNumber = cleanText($(tds.get(0)).text());
      buildingUse = cleanText($(tds.get(1)).text());
      quality = cleanText($(tds.get(2)).text());
      yearBuilt = parseInt(cleanText($(tds.get(4)).text()), 10) || null;
      yearCond = parseInt(cleanText($(tds.get(5)).text()), 10) || null;
      floors =
        floors != null ? floors : parseFloat(cleanText($(tds.get(6)).text())) || null;
      if (acArea == null) {
        const acText = cleanText($(tds.get(11)).text());
        acArea = acText ? parseInt(acText.replace(/[^0-9]/g, ""), 10) || null : null;
      }
      if (totalArea == null) {
        const totText = cleanText($(tds.get(12)).text());
        totalArea = totText
          ? parseInt(totText.replace(/[^0-9]/g, ""), 10) || null
          : null;
      }
    }
  }
  const structure = {
    building_identifier: buildingNumber || null,
    structure_quality_type: quality || null,
    structure_use_description: buildingUse || null,
    stories_count: floors != null ? Number(floors) : null,
    area_under_air: acArea != null ? Number(acArea) : null,
    total_area: totalArea != null ? Number(totalArea) : null,
    construction_year: yearBuilt,
    effective_year: yearCond,
  };
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
  const landUse = cleanText($(tds.get(0)).text());
  const zoning = cleanText($(tds.get(1)).text());
  const landUnits = cleanText($(tds.get(2)).text());
  const unitType = cleanText($(tds.get(3)).text());
  const depth = cleanText($(tds.get(4)).text());
  const frontage = cleanText($(tds.get(5)).text());
  const value = parseCurrencyToNumber($(tds.get(6)).text());
  return {
    land_use_description: landUse || null,
    zoning: zoning || null,
    lot_unit_type: unitType || null,
    lot_unit_count: landUnits ? parseFloat(landUnits.replace(/[^0-9.]/g, "")) : null,
    frontage_length: frontage ? parseFloat(frontage.replace(/[^0-9.]/g, "")) : null,
    depth_length: depth ? parseFloat(depth.replace(/[^0-9.]/g, "")) : null,
    land_value_amount: value,
  };
}

function buildUtilities(pathToOwnersUtilities, parcelId, dataDir) {
  try {
    const utilities = readJSON(pathToOwnersUtilities);
    if (!utilities) return;
    if (utilities.electric_provider)
      utilities.electric_provider = cleanText(utilities.electric_provider);
    if (utilities.gas_provider)
      utilities.gas_provider = cleanText(utilities.gas_provider);
    if (utilities.water_provider)
      utilities.water_provider = cleanText(utilities.water_provider);
    if (utilities.sewer_provider)
      utilities.sewer_provider = cleanText(utilities.sewer_provider);
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
  try {
    buildAddressOutput("address.json", path.join(dataDir, "address.json"));
  } catch {}
  const { property, floors, acArea, totalArea } = extractProperty($);
  property.parcel_identifier = parcelId || property.parcel_identifier;
  if (!property.parcel_identifier) throw new Error("parcel_identifier missing");
  writeJSON(path.join(dataDir, "property.json"), property);
  const tax = extractTax($);
  if (tax && tax.tax_year)
    writeJSON(path.join(dataDir, `tax_${tax.tax_year}.json`), tax);
  const sales = extractSales($);
  const salesFiles = [];
  sales.forEach((s, idx) => {
    const fn = path.join(dataDir, `sales_${idx + 1}.json`);
    const { links, ...salesData } = s;
    writeJSON(fn, salesData);
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
    );
  } catch {}
  try {
    buildLayouts(path.join("owners", "layout_data.json"), parcelId, dataDir);
  } catch {}
  try {
    const structure = extractStructure($, { floors, acArea, totalArea });
    writeJSON(path.join(dataDir, "structure.json"), structure);
  } catch {}
  try {
    const lot = extractLot($);
    writeJSON(path.join(dataDir, "lot.json"), lot);
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
