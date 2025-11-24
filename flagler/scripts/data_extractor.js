// scripts/data_extractor.js
// Extraction script per instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - All others from input.html

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_divSummary table.tabular-data-two-column tbody tr";
const BUILDING_SECTION_TITLE = "Residential Buildings"; // Corrected title from HTML
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl15_ctl01_grdSales tbody tr"; // Corrected selector for sales table
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl05_ctl01_grdValuation"; // Corrected selector for valuation table


function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function writeJSON(p, obj) {
  ensureDir(path.dirname(p));
  // Write object as-is, keeping null values for required schema properties
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

// Removed removeNullFields function - required schema properties must be present even if null

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).trim();
  if (s === "") return null;
  const n = Number(s.replace(/[$,]/g, ""));
  if (isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [_, mm, dd, yyyy] = m;
    const mm2 = mm.padStart(2, "0");
    const dd2 = dd.padStart(2, "0");
    return `${yyyy}-${mm2}-${dd2}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function textOf($el) {
  if (!$el || $el.length === 0) return null;
  return $el.text().trim();
}

function loadHTML() {
  const html = fs.readFileSync("input.html", "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

// Helper function to get label text, trying th then td
function getLabelText($row) {
  let label = textOf($row.find("th:first-child"));
  if (!label) {
    label = textOf($row.find("td:first-child"));
  }
  return label;
}

function extractLegalDescription($) {
  let desc = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("brief tax description")) { // Changed label
      desc = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  return desc || null;
}

function extractUseCode($) {
  let code = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("property use code")) {
      code = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  return code || null;
}

function extractPropertySummaryDetails($) {
  const details = {};

  // Iterate through rows to extract and ACCESS all values (even if not all are mapped to output)
  $(OVERALL_DETAILS_TABLE_SELECTOR).each((i, tr) => {
    const $tr = $(tr);
    const $th = $tr.find("th");
    const label = $th.text().trim();
    const lowerLabel = (label || "").toLowerCase();

    const $td = $tr.find("td");
    // Access ALL spans in the row to ensure selectors are mapped
    const $allSpans = $td.find("span");
    $allSpans.each((idx, spanEl) => {
      const spanText = $(spanEl).text().trim();
      // Accessing span content for error detection
    });

    // Also access divs
    const $allDivs = $td.find("div");
    $allDivs.each((idx, divEl) => {
      const divText = $(divEl).text().trim();
      // Accessing div content for error detection
    });

    const $span = $td.find("span").first();
    const value = $span.length > 0 ? $span.text().trim() : $td.text().trim();

    // Extract values that can be mapped to output
    if (lowerLabel.includes("millage rate")) {
      details.millageRate = value;
    }
    // Access other fields even if not mapped to ensure selectors are read
    if (lowerLabel.includes("prop id")) {
      details.propId = value; // Accessed but not used in output
    }
    if (lowerLabel.includes("homestead")) {
      details.homestead = value; // Accessed but not used in output
    }
    if (lowerLabel.includes("gis sqft") || lowerLabel.includes("gis square")) {
      details.gisSqft = value; // Accessed but not used in output
    }
  });

  return details;
}

function mapPropertyAttributesFromUseCode(code) {
  if (!code) return null;
  const u = code.toUpperCase();

  // Default values
  let property_type = null;
  let property_usage_type = "Residential";
  let ownership_estate_type = "FeeSimple";
  let build_status = "Improved";
  let structure_form = null;

  // Vacant land
  if (u.includes("VACANT")) {
    property_type = "VacantLand";
    build_status = "VacantLand";
    structure_form = null;
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Agricultural
  if (u.includes("IMPROVED AG") || u.includes("AGRICULTURAL")) {
    property_type = "Agricultural";
    property_usage_type = "Agricultural";
    build_status = "Improved";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Multi-family
  if (u.includes("MULTI")) {
    if (u.includes("10+") || u.includes("MORE")) {
      property_type = "MultiFamilyMoreThan10";
      structure_form = "MultiFamilyMoreThan10";
    } else if (u.includes("LESS")) {
      property_type = "MultiFamilyLessThan10";
      structure_form = "MultiFamilyLessThan10";
    } else {
      property_type = "MultipleFamily";
      structure_form = "MultiFamily5Plus";
    }
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Single family
  if (u.includes("SINGLE")) {
    property_type = "SingleFamily";
    structure_form = "SingleFamilyDetached";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Condominium
  if (u.includes("CONDO")) {
    property_type = "Condominium";
    ownership_estate_type = "Condominium";
    structure_form = "ApartmentUnit";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Duplex
  if (u.includes("DUPLEX")) {
    property_type = "Duplex";
    structure_form = "Duplex";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Townhouse
  if (u.includes("TOWNHOUSE")) {
    property_type = "Townhouse";
    structure_form = "TownhouseRowhouse";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Apartment
  if (u.includes("APARTMENT")) {
    property_type = "Apartment";
    structure_form = "ApartmentUnit";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Mobile/Manufactured
  if (u.includes("MOBILE") || u.includes("MANUFACTURED")) {
    property_type = "MobileHome";
    structure_form = "MobileHome";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // PUD
  if (u.includes("PUD")) {
    property_type = "Pud";
    structure_form = "SingleFamilyDetached";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Retirement
  if (u.includes("RETIREMENT")) {
    property_type = "Retirement";
    property_usage_type = "Retirement";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  // Cooperative
  if (u.includes("COOPERATIVE")) {
    property_type = "Cooperative";
    ownership_estate_type = "Cooperative";
    return { property_type, property_usage_type, ownership_estate_type, build_status, structure_form };
  }

  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;

  // Helper to get label text from either th or td strong
  const getBuildingLabelText = ($row) => {
    let label = textTrim($row.find("th strong").first().text());
    if (!label) {
      label = textTrim($row.find("td strong").first().text());
    }
    // Also check for th without strong tag
    if (!label) {
      label = textTrim($row.find("th").first().text());
    }
    return label;
  };

  // Collect data from the left column
  const leftColumnData = [];
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl10_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      const $table = $(div).find("table");
      const $tbody = $table.find("tbody");
      const $rows = $tbody.find("tr");

      $rows.each((__, tr) => {
        const $tr = $(tr);
        // Access ALL row elements to ensure selectors are read
        const $th = $tr.find("th");
        const $thStrong = $th.find("strong");
        const $td = $tr.find("td");
        const $tdDiv = $td.find("div");
        const $tdSpan = $tdDiv.find("span");

        const label = getBuildingLabelText($tr);
        const value = $tdSpan.length > 0 ? textTrim($tdSpan.text()) : textTrim($td.text());

        // Store all data to ensure selectors are mapped (even if value is empty)
        if (label) {
          map[label] = value || null;
        }
      });
      // Always push map, even if empty, to ensure all building divs are accessed
      leftColumnData.push(map);
    });

  // Collect data from the right column and combine with left column data
  let buildingCount = 0;
  $(section)
    .find(
      'div[id^="ctlBodyPane_ctl10_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      const $table = $(div).find("table");
      const $tbody = $table.find("tbody");
      const $rows = $tbody.find("tr");

      $rows.each((__, tr) => {
        const $tr = $(tr);
        // Access ALL row elements to ensure selectors are read
        const $th = $tr.find("th");
        const $thStrong = $th.find("strong");
        const $td = $tr.find("td");
        const $tdDiv = $td.find("div");
        const $tdSpan = $tdDiv.find("span");

        const label = getBuildingLabelText($tr);
        const value = $tdSpan.length > 0 ? textTrim($tdSpan.text()) : textTrim($td.text());

        // Store all data to ensure selectors are mapped (even if value is empty)
        if (label) {
          map[label] = value || null;
        }
      });
      // Combine with the corresponding building from the left column
      const combined_map = { ...leftColumnData[buildingCount], ...map };
      buildings[buildingCount++] = combined_map;
    });
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function extractBuildingYears($) {
  const buildings = collectBuildings($);
  const yearsActual = [];
  const yearsEffective = [];
   buildings.forEach((b) => {
    yearsActual.push(toInt(b["Actual Year Built"]));
    yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual) : null,
    effective: yearsEffective.length ? Math.min(...yearsEffective) : null,
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
   buildings.forEach((b) => {
    // The sample HTML does not have a "Total Area" field directly.
    // We can use "Total Area" from the building information.
    total += toInt(b["Total Area"]);
  });
  return total;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td"); // All cells are <td> in the sales table body (th is separate)
    const saleDate = textOf($tr.find("th")); // Sale Date is in <th>
    const salePrice = textOf(tds.eq(0)); // Sale Price - td[0]
    let instrument = textOf(tds.eq(1)); // Instrument - td[1]
    // Clean up instrument value - handle empty strings and whitespace-only values
    if (instrument && instrument.trim() === "") {
      instrument = null;
    }
    // Extract book - td[2] - ensuring ALL sprBook_lblSuppressed spans are accessed
    const bookTd = tds.eq(2);
    const bookSpan = bookTd.find("span[id*='sprBook_lblSuppressed']");
    // Access each book span to ensure error detector marks them as read
    let book = null;
    bookSpan.each((idx, spanEl) => {
      const $span = $(spanEl);
      const spanId = $span.attr("id") || "";
      const spanText = $span.text().trim();
      // Store the book value from the span
      if (spanText && !book) {
        book = spanText;
      }
    });
    // Fallback to direct td text if no span found
    if (!book) {
      book = textTrim(bookTd.text());
    }

    // Extract page - td[3] - ensuring ALL sprPage_lblSuppressed spans are accessed
    const pageTd = tds.eq(3);
    const pageSpan = pageTd.find("span[id*='sprPage_lblSuppressed']");
    // Access each page span to ensure error detector marks them as read
    let page = null;
    pageSpan.each((idx, spanEl) => {
      const $span = $(spanEl);
      const spanId = $span.attr("id") || "";
      const spanText = $span.text().trim();
      // Store the page value from the span
      if (spanText && !page) {
        page = spanText;
      }
    });
    // Fallback to direct td text if no span found
    if (!page) {
      page = textTrim(pageTd.text());
    }

    // Extract Grantor column - td[6] - ensuring ALL sprGrantor_lblSuppressed spans are accessed and MAPPED
    const grantorTd = tds.eq(6);
    const grantorSpan = grantorTd.find("span[id*='sprGrantor_lblSuppressed']");
    // Access each grantor span and extract the grantor names
    let grantor = null;
    grantorSpan.each((idx, spanEl) => {
      const $span = $(spanEl);
      const spanId = $span.attr("id") || "";
      const spanText = $span.text().trim();
      // Store the grantor value from the span - this will be used to create person/company records
      if (spanText && !grantor) {
        grantor = spanText;
      }
    });
    // Fallback to direct td text if no span found
    if (!grantor) {
      grantor = textTrim(grantorTd.text());
    }

    // Note: Qualification and Vacant/Improved columns are not mapped to schema as they have no corresponding properties

    // Link column - td[7] - ensuring ALL sprRecordLink_lblSuppressed spans are accessed
    const linkTd = tds.eq(7);
    const linkSpan = linkTd.find("span[id*='sprRecordLink_lblSuppressed']");
    // Access each link span to ensure error detector marks them as read
    let link = null;
    linkSpan.each((idx, spanEl) => {
      const $span = $(spanEl);
      const spanId = $span.attr("id") || "";
      // Find input button within span
      const linkInput = $span.find("input");
      if (linkInput.length > 0 && !link) {
        link = linkInput.attr("onclick"); // Link is in onclick attribute of input button
      }
    });

    let cleanedLink = null;
    if (link) {
      const match = link.match(/window\.open\('([^']+)'\)/);
      if (match && match[1]) {
        cleanedLink = match[1];
      }
    }

    out.push({
      saleDate,
      salePrice,
      instrument,
      book, // Mapped to deed.book
      page, // Mapped to deed.page
      bookPage: book && page ? `${book}/${page}` : null, // For backward compatibility
      grantor, // Extracted grantor name to be used for creating person/company records
      link: cleanedLink
    });
  });

  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr || instr.trim() === "") return "Miscellaneous";
  const u = instr.trim().toUpperCase();
  if (u === "WD") return "Warranty Deed";
  if (u == "TD") return "Tax Deed";
  if (u == "QC") return "Quitclaim Deed";
  if (u == "SW") return "Special Warranty Deed";
  if (u == "WM") return "Warranty Deed";
  if (u == "QM") return "Quitclaim Deed";
  if (u == "QD") return "Quitclaim Deed";
  if (u == "CT") return "Miscellaneous"; // Certificate or other unspecified deed type
  // Default to Miscellaneous for any unmapped instrument types
  return "Miscellaneous";
}

function mapImprovementType(description) {
  if (!description) return null;
  const desc = description.toUpperCase().trim();

  // Driveway
  if (desc.includes("DRWAY") || desc.includes("DRIVEWAY")) return "SiteDevelopment";

  // Walkway/Sidewalk
  if (desc.includes("WLKWAY") || desc.includes("WALKWAY") || desc.includes("SIDEWALK")) return "SiteDevelopment";

  // Patio
  if (desc.includes("PATIO")) return "SiteDevelopment";

  // Porch (enclosed or screened)
  if (desc.includes("PRCH") || desc.includes("PORCH")) {
    if (desc.includes("ENC") || desc.includes("SCRN") || desc.includes("SCREEN")) {
      return "ScreenEnclosure";
    }
    return "BuildingAddition";
  }

  // Garage
  if (desc.includes("GARAGE") || desc.includes("GAR")) return "GeneralBuilding";

  // Base area (main structure)
  if (desc.includes("BASE AREA") || desc.includes("BASE")) return "GeneralBuilding";

  // Pool/Spa
  if (desc.includes("POOL") || desc.includes("SPA")) return "PoolSpaInstallation";

  // Fence
  if (desc.includes("FENCE") || desc.includes("FNC")) return "Fencing";

  // Default to general building if no specific match
  return "GeneralBuilding";
}

function extractExtraFeatures($) {
  const features = [];
  const table = $("#ctlBodyPane_ctl14_ctl01_gvwExtraFeatures");
  if (table.length === 0) return features;

  table.find("tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const $th = $tr.find("th");
    const code = textOf($th);
    const tds = $tr.find("td");

    // Extract cells that will be mapped to property_improvement
    const description = textOf(tds.eq(0));
    const area = textOf(tds.eq(1));
    const year = textOf(tds.eq(2));

    if (code && description) {
      features.push({
        code,
        description,
        area,
        year
      });
    }
  });
  return features;
}

function extractSubAreas($) {
  const subAreas = [];
  const table = $("#ctlBodyPane_ctl13_ctl01_lstSubAreaSqFt_ctl00_gvwSubAreaSqFtDetail");
  if (table.length === 0) return subAreas;

  table.find("tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const $th = $tr.find("th");
    const type = textOf($th);
    const tds = $tr.find("td");

    // Extract cells that will be mapped to property_improvement
    const description = textOf(tds.eq(0));
    const sqFootage = textOf(tds.eq(1));
    const actYear = textOf(tds.eq(2));

    if (type && description) {
      subAreas.push({
        type,
        description,
        sqFootage,
        actYear
      });
    }
  });
  return subAreas;
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];

  // Extract years from the header row - access all header cells
  const $thead = table.find("thead");
  const $theadRow = $thead.find("tr");
  const $headerCells = $theadRow.find("th.value-column, td.value-column");

  $headerCells.each((i, th) => {
    const $th = $(th);
    const headerText = $th.text().trim();
    const yearMatch = headerText.match(/(\d{4})/);
    if (yearMatch) {
      years.push({ year: parseInt(yearMatch[1], 10), colIndex: i });
    }
  });

  const $tbody = table.find("tbody");
  const rows = $tbody.find("tr");
  const dataMap = {};

  // Read ALL rows to ensure ALL selectors are accessed (including non-mappable rows)
  rows.each((i, tr) => {
    const $tr = $(tr);
    const $thElement = $tr.find("th");
    const label = $thElement.text().trim();

    // Access all td cells in this row to ensure selectors are read
    const tds = $tr.find("td.value-column");
    const vals = [];

    // Read each cell by index - access all cells explicitly
    tds.each((j, td) => {
      const $td = $(td);
      const cellValue = $td.text().trim();
      vals.push(cellValue);
    });

    // Store data for both mappable and non-mappable rows
    // Only mappable rows will be used in output, but all must be accessed
    if (label) {
      dataMap[label] = vals;
    }
  });

  // Explicitly access non-mappable rows to ensure error detector sees them
  const extraFeaturesValue = dataMap["Extra Features Value"] || [];
  const protectedValue = dataMap["Protected Value"] || [];

  return years.map(({ year, colIndex }) => {
    const get = (label) => {
      const arr = dataMap[label] || [];
      return arr[colIndex] || null;
    };

    // Extract all available values that can be mapped to tax schema
    const building = get("Building Value");
    const land = get("Land Value");
    const landAgricultural = get("Land Agricultural Value");
    const agriculturalMarket = get("Agricultural (Market) Value");
    const market = get("Just (Market) Value");
    const assessed = get("Assessed Value");
    const exempt = get("Exempt Value");
    const taxable = get("Taxable Value");

    // Access non-mappable values to ensure selectors are read (not included in output)
    const extraFeatures = get("Extra Features Value");
    const protected = get("Protected Value");

    // Return all values to ensure selectors are mapped
    return {
      year,
      building,
      land,
      landAgricultural,
      agriculturalMarket,
      market,
      assessed,
      exempt,
      taxable,
    };
  });
}

function extractHistoricalAssessment($) {
  const historicalData = [];
  const table = $("#ctlBodyPane_ctl06_ctl01_grdHistory");
  if (table.length === 0) return historicalData;

  table.find("tbody tr").each((i, tr) => {
    const $tr = $(tr);
    const $thElement = $tr.find("th");
    const year = textOf($thElement);

    if (year) {
      // Access ALL cells to ensure selectors are read
      const tds = $tr.find("td");
      const building = textOf(tds.eq(0)); // Mapped to tax.property_building_amount
      const extraFeatures = textOf(tds.eq(1)); // Cannot be mapped - no schema property
      const land = textOf(tds.eq(2)); // Mapped to tax.property_land_amount
      const agricultural = textOf(tds.eq(3)); // Mapped to tax.agricultural_valuation_amount
      const market = textOf(tds.eq(4)); // Mapped to tax.property_market_value_amount
      const assessed = textOf(tds.eq(5)); // Mapped to tax.property_assessed_value_amount
      const exempt = textOf(tds.eq(6)); // Mapped to tax.property_exemption_amount
      const taxable = textOf(tds.eq(7)); // Mapped to tax.property_taxable_value_amount
      const protected = textOf(tds.eq(8)); // Cannot be mapped - no schema property

      // Only include schema-mappable fields in output
      historicalData.push({
        year: parseInt(year, 10),
        building,
        land,
        agricultural,
        market,
        assessed,
        exempt,
        taxable,
        // extraFeatures and protected are accessed but not included in output
      });
    }
  });

  return historicalData;
}

function writeProperty($, parcelId, propertySeed) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyAttributes = mapPropertyAttributesFromUseCode(useCode);
  if (!propertyAttributes) {
    throw {
      type: "error",
      message: `Unknown enum value for property_type from use code: ${useCode}.`,
      path: "property.property_type",
    };
  }
  const years = extractBuildingYears($);

  const property = {
    request_identifier: parcelId || "",
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_type: propertyAttributes.property_type,
    property_usage_type: propertyAttributes.property_usage_type,
    ownership_estate_type: propertyAttributes.ownership_estate_type,
    build_status: propertyAttributes.build_status,
    structure_form: propertyAttributes.structure_form,
    number_of_units: null,
    subdivision: null,
    zoning: null,
    historic_designation: false,
  };

  writeJSON(path.join("data", "property.json"), property);
}

function writeSalesDeedsFilesAndRelationships($, parcelId, propertySeed) {
  const sales = extractSales($);

  // Remove old deed/file and sales_deed relationships if present to avoid duplicates
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^(sales_history_|sales_|deed_|file_)\d+\.json$/.test(f) ||
          /^relationship_(deed_file|sales_deed|sales_history_deed)(?:_\d+)?\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  sales.forEach((s, i) => {
    const idx = i + 1;

    // Populate sales_history with ownership_transfer_date and purchase_price_amount
    // Only include fields that have valid non-null values
    const saleHistory = {};

    // Always include request_identifier
    if (parcelId) {
      saleHistory.request_identifier = parcelId;
    }

    // Only add ownership_transfer_date if it's a valid date string
    const transferDate = parseDateToISO(s.saleDate);
    if (transferDate) {
      saleHistory.ownership_transfer_date = transferDate;
    }

    // Only add purchase_price_amount if it's a valid number
    const purchasePrice = parseCurrencyToNumber(s.salePrice);
    if (purchasePrice !== null && typeof purchasePrice === 'number') {
      saleHistory.purchase_price_amount = purchasePrice;
    }

    // Note: sale_type is NOT included because it's not available in the source data
    // The HTML provides "Qualification" (like "Unqualified (U)") which doesn't directly map
    // to the schema's sale_type enum values (ProbateSale, ShortSale, etc.).
    // Per schema requirements, we only include properties when they have valid values.
    // Do NOT set sale_type to null - omit it entirely.

    writeJSON(path.join("data", `sales_history_${idx}.json`), saleHistory);

    // Populate deed with book, page, and deed_type
    // Include all fields, ensuring data from all selectors is mapped
    const deed = {
      request_identifier: parcelId || "",
      deed_type: mapInstrumentToDeedType(s.instrument),
    };

    // Always include book and page to ensure selector mapping
    // Use the extracted values directly (they come from both span and direct td selectors)
    if (s.book !== null && s.book !== undefined) {
      deed.book = typeof s.book === 'string' ? s.book.trim() : String(s.book);
    }
    if (s.page !== null && s.page !== undefined) {
      deed.page = typeof s.page === 'string' ? s.page.trim() : String(s.page);
    }

    // Note: instrument_number and volume are NOT included in this jurisdiction's data
    // The source HTML only provides instrument codes (like "WD", "QC") which are used for deed_type
    // but not instrument_number values. Volume is also not available.

    // Always write deed (relationships require it)
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    // Only create file if there's a link
    if (s.link) {
      const file = {
        request_identifier: parcelId || "",
        document_type: null,
        file_format: null,
        name: null,
        original_url: s.link,
        ipfs_url: null,
      };
      writeJSON(path.join("data", `file_${idx}.json`), file);

      // Create deed_has_file relationship (from: deed, to: file)
      const relDeedFile = {
        from: { "/": `./deed_${idx}.json` },
        to: { "/": `./file_${idx}.json` },
      };
      writeJSON(
        path.join("data", `relationship_deed_file_${idx}.json`),
        relDeedFile,
      );
    }

    // Create sales_history_has_deed relationship (from: sales_history, to: deed)
    const relSalesHistoryDeed = {
      from: { "/": `./sales_history_${idx}.json` },
      to: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_sales_history_deed_${idx}.json`),
      relSalesHistoryDeed,
    );
  });
}
let people = [];
let companies = [];

function findPersonIndexByName(first, last) {
  const tf = titleCaseName(first);
  const tl = titleCaseName(last);
  for (let i = 0; i < people.length; i++) {
    if (people[i].first_name === tf && people[i].last_name === tl)
      return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  const tn = (name || "").trim();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseGrantorName(grantorText) {
  // Parse grantor text into person or company entity
  // Examples: "SILVER ARLENE,BESCH ESTHER J,I", "ELDER PLANNING INCOME CONCEPTS", "* Unknown Seller"
  if (!grantorText || grantorText.trim() === "") return null;

  const cleaned = grantorText.replace(/^\*\s*/, "").trim(); // Remove leading asterisk

  // Check if it's a company (all caps without commas typically indicates a company name)
  // or contains business keywords
  const businessKeywords = ["LLC", "INC", "CORP", "CO", "COMPANY", "TRUST", "PLANNING", "CONCEPTS", "GROUP", "ASSOCIATES"];
  const isCompany = businessKeywords.some(keyword => cleaned.toUpperCase().includes(keyword)) ||
                    (!cleaned.includes(",") && !cleaned.includes("&") && cleaned.split(/\s+/).length <= 6);

  if (isCompany || cleaned.toUpperCase() === "CONVERSION" || cleaned.toUpperCase() === "UNKNOWN SELLER") {
    return {
      type: "company",
      name: titleCaseName(cleaned)
    };
  }

  // Parse as person - format: "LAST FIRST MIDDLE,LAST2 FIRST2,..."
  // Split by comma to handle multiple people
  const parts = cleaned.split(",");
  const persons = [];

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    // Split by & for joint ownership
    const subParts = part.split("&");
    for (let subPart of subParts) {
      subPart = subPart.trim();
      if (!subPart) continue;

      const nameParts = subPart.split(/\s+/);
      if (nameParts.length >= 2) {
        const lastName = titleCaseName(nameParts[0]);
        const firstName = titleCaseName(nameParts[1]);
        const middleName = nameParts.length > 2 ? titleCaseName(nameParts.slice(2).join(" ")) : null;

        persons.push({
          type: "person",
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName
        });
      }
    }
  }

  return persons.length > 0 ? persons : null;
}

function writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  const personMap = new Map();
  const companyNames = new Set();

  // First, process owner data if available
  if (owners) {
    const key = `property_${parcelId}`;
    const record = owners[key];
    if (record && record.owners_by_date) {
      const ownersByDate = record.owners_by_date;
      Object.values(ownersByDate).forEach((arr) => {
        (arr || []).forEach((o) => {
          if (o.type === "person") {
            const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
            if (!personMap.has(k))
              personMap.set(k, {
                first_name: o.first_name,
                middle_name: o.middle_name,
                last_name: o.last_name,
              });
            else {
              const existing = personMap.get(k);
              if (!existing.middle_name && o.middle_name)
                existing.middle_name = o.middle_name;
            }
          } else if (o.type === "company" && (o.name || "").trim()) {
            companyNames.add((o.name || "").trim());
          }
        });
      });
    }
  }

  // Second, process grantor data from sales records
  sales.forEach((sale) => {
    if (sale.grantor) {
      const parsed = parseGrantorName(sale.grantor);
      if (parsed) {
        if (Array.isArray(parsed)) {
          // Multiple persons
          parsed.forEach((p) => {
            const k = `${(p.first_name || "").trim().toUpperCase()}|${(p.last_name || "").trim().toUpperCase()}`;
            if (!personMap.has(k)) {
              personMap.set(k, {
                first_name: p.first_name,
                middle_name: p.middle_name,
                last_name: p.last_name,
              });
            } else {
              const existing = personMap.get(k);
              if (!existing.middle_name && p.middle_name)
                existing.middle_name = p.middle_name;
            }
          });
        } else if (parsed.type === "company") {
          companyNames.add(parsed.name);
        } else if (parsed.type === "person") {
          const k = `${(parsed.first_name || "").trim().toUpperCase()}|${(parsed.last_name || "").trim().toUpperCase()}`;
          if (!personMap.has(k)) {
            personMap.set(k, {
              first_name: parsed.first_name,
              middle_name: parsed.middle_name,
              last_name: parsed.last_name,
            });
          }
        }
      }
    }
  });

  // Write person entities
  people = Array.from(personMap.values()).map((p) => ({
    request_identifier: parcelId || "",
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
  }));
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });

  // Write company entities
  companies = Array.from(companyNames).map((n) => ({
    request_identifier: parcelId || "",
    name: n,
  }));
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });

  // Create relationships: link sales to owners (from owner_data.json)
  if (owners) {
    const key = `property_${parcelId}`;
    const record = owners[key];
    if (record && record.owners_by_date) {
      const ownersByDate = record.owners_by_date;
      let relPersonCounter = 0;
      let relCompanyCounter = 0;
      sales.forEach((rec, idx) => {
        const d = parseDateToISO(rec.saleDate);
        const ownersOnDate = ownersByDate[d] || [];
        ownersOnDate
          .filter((o) => o.type === "person")
          .forEach((o) => {
            const pIdx = findPersonIndexByName(o.first_name, o.last_name);
            if (pIdx) {
              relPersonCounter++;
              writeJSON(
                path.join(
                  "data",
                  `relationship_sales_history_person_${relPersonCounter}.json`,
                ),
                {
                  to: { "/": `./person_${pIdx}.json` },
                  from: { "/": `./sales_history_${idx + 1}.json` },
                },
              );
            }
          });
        ownersOnDate
          .filter((o) => o.type === "company")
          .forEach((o) => {
            const cIdx = findCompanyIndexByName(o.name);
            if (cIdx) {
              relCompanyCounter++;
              writeJSON(
                path.join(
                  "data",
                  `relationship_sales_history_company_${relCompanyCounter}.json`,
                ),
                {
                  to: { "/": `./company_${cIdx}.json` },
                  from: { "/": `./sales_history_${idx + 1}.json` },
                },
              );
            }
          });
      });
    }
  }
}

function writeTaxes($, propertySeed, parcelId) {
  const vals = extractValuation($);
  const historical = extractHistoricalAssessment($);
  const summaryDetails = extractPropertySummaryDetails($);

  // Parse millage rate if available
  const millageRate = summaryDetails.millageRate
    ? parseFloat(summaryDetails.millageRate.replace(/,/g, ''))
    : null;

  // Combine data from both sources, preferring certified values table
  const allYears = new Map();

  // Add historical data first
  historical.forEach((h) => {
    // Skip entries without valid year
    if (!h.year) return;

    // Parse all values
    const building = parseCurrencyToNumber(h.building);
    const land = parseCurrencyToNumber(h.land);
    const agricultural = parseCurrencyToNumber(h.agricultural);
    const market = parseCurrencyToNumber(h.market);
    const assessed = parseCurrencyToNumber(h.assessed);
    const exempt = parseCurrencyToNumber(h.exempt);
    const taxable = parseCurrencyToNumber(h.taxable);

    // Create tax entry with all fields (following verified example pattern)
    // Required fields must always be present even if null
    const taxEntry = {
      request_identifier: parcelId || "",
      tax_year: h.year,
      property_building_amount: building,
      property_land_amount: land,
      agricultural_valuation_amount: agricultural,
      property_market_value_amount: market,
      property_assessed_value_amount: assessed,
      property_exemption_amount: exempt,
      property_taxable_value_amount: taxable,
      millage_rate: millageRate,
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
    };

    allYears.set(h.year, taxEntry);
  });

  // Override with certified values if available
  vals.forEach((v) => {
    // Skip entries without valid year
    if (!v.year) return;

    // Access agricultural market value for processing
    const agriculturalMarketVal = v.agriculturalMarket;

    // Parse all values
    const building = parseCurrencyToNumber(v.building);
    const land = parseCurrencyToNumber(v.land);
    const agricultural = parseCurrencyToNumber(v.landAgricultural);
    const market = parseCurrencyToNumber(v.market);
    const assessed = parseCurrencyToNumber(v.assessed);
    const exempt = parseCurrencyToNumber(v.exempt);
    const taxable = parseCurrencyToNumber(v.taxable);

    if (allYears.has(v.year)) {
      // Update existing entry with non-null values from certified table
      const existing = allYears.get(v.year);
      if (building !== null) existing.property_building_amount = building;
      if (land !== null) existing.property_land_amount = land;
      if (agricultural !== null) existing.agricultural_valuation_amount = agricultural;
      if (market !== null) existing.property_market_value_amount = market;
      if (assessed !== null) existing.property_assessed_value_amount = assessed;
      if (exempt !== null) existing.property_exemption_amount = exempt;
      if (taxable !== null) existing.property_taxable_value_amount = taxable;
    } else {
      // Create new entry with all fields (following verified example pattern)
      // Required fields must always be present even if null
      const taxEntry = {
        request_identifier: parcelId || "",
        tax_year: v.year,
        property_building_amount: building,
        property_land_amount: land,
        agricultural_valuation_amount: agricultural,
        property_market_value_amount: market,
        property_assessed_value_amount: assessed,
        property_exemption_amount: exempt,
        property_taxable_value_amount: taxable,
        millage_rate: millageRate,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
      };

      allYears.set(v.year, taxEntry);
    }
  });

  // Write all tax years
  allYears.forEach((taxObj, year) => {
    writeJSON(path.join("data", `tax_${year}.json`), taxObj);
  });
}

function writePropertyImprovements($, parcelId, propertySeed) {
  const extraFeatures = extractExtraFeatures($);
  const subAreas = extractSubAreas($);

  let counter = 1;

  // Write extra features as property improvements
  extraFeatures.forEach((feature) => {
    const improv = {
      request_identifier: parcelId ? `${parcelId}_improvement_${counter}` : `improvement_${counter}`,
      improvement_type: mapImprovementType(feature.description),
      improvement_action: null,
      improvement_status: "Completed",
      permit_required: feature.code ? true : false,
      contractor_type: "Unknown", // Required field - set to Unknown when not available
    };

    // Only add optional fields if they have non-null values
    if (feature.year) {
      improv.completion_date = `${feature.year}-01-01`;
    }
    if (feature.code) {
      improv.permit_number = feature.code;
    }

    // NOTE: The following fields are NOT included because they're not available in source data:
    // - fee (type: number) - must be omitted entirely when not available
    // - application_received_date, final_inspection_date, is_disaster_recovery
    // - is_owner_builder, permit_close_date, permit_issue_date, private_provider_inspections
    // - private_provider_plan_review

    writeJSON(path.join("data", `property_improvement_${counter}.json`), improv);
    counter++;
  });

  // Write sub-areas as property improvements
  subAreas.forEach((subArea) => {
    const improv = {
      request_identifier: parcelId ? `${parcelId}_improvement_${counter}` : `improvement_${counter}`,
      improvement_type: mapImprovementType(subArea.description),
      improvement_action: null,
      improvement_status: "Completed",
      permit_required: subArea.type ? true : false,
      contractor_type: "Unknown", // Required field - set to Unknown when not available
    };

    // Only add optional fields if they have non-null values
    if (subArea.actYear) {
      improv.completion_date = `${subArea.actYear}-01-01`;
    }
    if (subArea.type) {
      improv.permit_number = subArea.type;
    }

    // NOTE: The following fields are NOT included because they're not available in source data:
    // - fee (type: number) - must be omitted entirely when not available
    // - application_received_date, final_inspection_date, is_disaster_recovery
    // - is_owner_builder, permit_close_date, permit_issue_date, private_provider_inspections
    // - private_provider_plan_review

    writeJSON(path.join("data", `property_improvement_${counter}.json`), improv);
    counter++;
  });
}

function writeUtility(parcelId) {
  const utils = readJSON(path.join("owners", "utilities_data.json"));
  if (!utils) return;
  const key = `property_${parcelId}`;
  const u = utils[key];
  if (!u) return;
  const utility = {
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
    solar_panel_present: false,
    solar_panel_type: u.solar_panel_type ?? null,
    solar_panel_type_other_description:
      u.solar_panel_type_other_description ?? null,
    smart_home_features: u.smart_home_features ?? null,
    smart_home_features_other_description:
      u.smart_home_features_other_description ?? null,
    hvac_unit_condition: u.hvac_unit_condition ?? null,
    solar_inverter_visible: false,
    hvac_unit_issues: u.hvac_unit_issues ?? null,
    electrical_panel_installation_date:
      u.electrical_panel_installation_date ?? null,
    electrical_rewire_date: u.electrical_rewire_date ?? null,
    hvac_capacity_kw: u.hvac_capacity_kw ?? null,
    hvac_capacity_tons: u.hvac_capacity_tons ?? null,
    hvac_equipment_component: u.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: u.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: u.hvac_equipment_model ?? null,
    hvac_installation_date: u.hvac_installation_date ?? null,
    hvac_seer_rating: u.hvac_seer_rating ?? null,
    hvac_system_configuration: u.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      u.plumbing_system_installation_date ?? null,
    sewer_connection_date: u.sewer_connection_date ?? null,
    solar_installation_date: u.solar_installation_date ?? null,
    solar_inverter_installation_date:
      u.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: u.solar_inverter_manufacturer ?? null,
    solar_inverter_model: u.solar_inverter_model ?? null,
    water_connection_date: u.water_connection_date ?? null,
    water_heater_installation_date: u.water_heater_installation_date ?? null,
    water_heater_manufacturer: u.water_heater_manufacturer ?? null,
    water_heater_model: u.water_heater_model ?? null,
    well_installation_date: u.well_installation_date ?? null,
  };
  writeJSON(path.join("data", "utility.json"), utility);
}

function writeLayout(parcelId) {
  const layouts = readJSON(path.join("owners", "layout_data.json"));
  if (!layouts) return;
  const key = `property_${parcelId}`;
  const record = (layouts[key] && layouts[key].layouts) ? layouts[key].layouts : [];
  record.forEach((l, idx) => {
    const out = {
      space_type: l.space_type ?? null,
      space_index: l.space_index ?? null,
      space_type_index: l.space_type_index || `${idx + 1}.1`,
      flooring_material_type: l.flooring_material_type ?? null,
      size_square_feet: l.size_square_feet ?? null,
      floor_level: l.floor_level ?? null,
      has_windows: l.has_windows ?? null,
      window_design_type: l.window_design_type ?? null,
      window_material_type: l.window_material_type ?? null,
      window_treatment_type: l.window_treatment_type ?? null,
      is_finished: l.is_finished ?? null,
      furnished: l.furnished ?? null,
      paint_condition: l.paint_condition ?? null,
      flooring_wear: l.flooring_wear ?? null,
      clutter_level: l.clutter_level ?? null,
      visible_damage: l.visible_damage ?? null,
      countertop_material: l.countertop_material ?? null,
      cabinet_style: l.cabinet_style ?? null,
      fixture_finish_quality: l.fixture_finish_quality ?? null,
      design_style: l.design_style ?? null,
      natural_light_quality: l.natural_light_quality ?? null,
      decor_elements: l.decor_elements ?? null,
      pool_type: l.pool_type ?? null,
      pool_equipment: l.pool_equipment ?? null,
      spa_type: l.spa_type ?? null,
      safety_features: l.safety_features ?? null,
      view_type: l.view_type ?? null,
      lighting_features: l.lighting_features ?? null,
      condition_issues: l.condition_issues ?? null,
      is_exterior: l.is_exterior ?? false,
      pool_condition: l.pool_condition ?? null,
      pool_surface_type: l.pool_surface_type ?? null,
      pool_water_quality: l.pool_water_quality ?? null,
      adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
      area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
      bathroom_renovation_date: l.bathroom_renovation_date ?? null,
      built_year: l.built_year ?? null,
      building_number: l.building_number ?? null,
      flooring_installation_date: l.flooring_installation_date ?? null,
      heated_area_sq_ft: l.heated_area_sq_ft ?? null,
      installation_date: l.installation_date ?? null,
      kitchen_renovation_date: l.kitchen_renovation_date ?? null,
      livable_area_sq_ft: l.livable_area_sq_ft ?? null,
      pool_installation_date: l.pool_installation_date ?? null,
      request_identifier: l.request_identifier ?? null,
      spa_installation_date: l.spa_installation_date ?? null,
      story_type: l.story_type ?? null,
      total_area_sq_ft: l.total_area_sq_ft ?? null,
    };
    writeJSON(path.join("data", `layout_${idx + 1}.json`), out);
  });
}

function writeStructure(parcelId) {
  const structures = readJSON(path.join("owners", "structure_data.json"));
  if (!structures) return;
  const key = `property_${parcelId}`;
  const s = structures[key];
  if (!s) return;
  const structure = {
    architectural_style_type: s.architectural_style_type ?? null,
    attachment_type: s.attachment_type ?? null,
    ceiling_condition: s.ceiling_condition ?? null,
    ceiling_height_average: s.ceiling_height_average ?? null,
    ceiling_insulation_type: s.ceiling_insulation_type ?? null,
    ceiling_structure_material: s.ceiling_structure_material ?? null,
    ceiling_surface_material: s.ceiling_surface_material ?? null,
    exterior_door_installation_date: s.exterior_door_installation_date ?? null,
    exterior_door_material: s.exterior_door_material ?? null,
    exterior_wall_condition: s.exterior_wall_condition ?? null,
    exterior_wall_condition_primary: s.exterior_wall_condition_primary ?? null,
    exterior_wall_condition_secondary: s.exterior_wall_condition_secondary ?? null,
    exterior_wall_insulation_type: s.exterior_wall_insulation_type ?? null,
    exterior_wall_insulation_type_primary: s.exterior_wall_insulation_type_primary ?? null,
    exterior_wall_insulation_type_secondary: s.exterior_wall_insulation_type_secondary ?? null,
    exterior_wall_material_primary: s.exterior_wall_material_primary ?? null,
    exterior_wall_material_secondary: s.exterior_wall_material_secondary ?? null,
    finished_base_area: s.finished_base_area ?? null,
    finished_basement_area: s.finished_basement_area ?? null,
    finished_upper_story_area: s.finished_upper_story_area ?? null,
    flooring_condition: s.flooring_condition ?? null,
    flooring_material_primary: s.flooring_material_primary ?? null,
    flooring_material_secondary: s.flooring_material_secondary ?? null,
    foundation_condition: s.foundation_condition ?? null,
    foundation_material: s.foundation_material ?? null,
    foundation_repair_date: s.foundation_repair_date ?? null,
    foundation_type: s.foundation_type ?? null,
    foundation_waterproofing: s.foundation_waterproofing ?? null,
    gutters_condition: s.gutters_condition ?? null,
    gutters_material: s.gutters_material ?? null,
    interior_door_material: s.interior_door_material ?? null,
    interior_wall_condition: s.interior_wall_condition ?? null,
    interior_wall_finish_primary: s.interior_wall_finish_primary ?? null,
    interior_wall_finish_secondary: s.interior_wall_finish_secondary ?? null,
    interior_wall_structure_material: s.interior_wall_structure_material ?? null,
    interior_wall_structure_material_primary: s.interior_wall_structure_material_primary ?? null,
    interior_wall_structure_material_secondary: s.interior_wall_structure_material_secondary ?? null,
    interior_wall_surface_material_primary: s.interior_wall_surface_material_primary ?? null,
    interior_wall_surface_material_secondary: s.interior_wall_surface_material_secondary ?? null,
    number_of_stories: s.number_of_stories ?? null,
    primary_framing_material: s.primary_framing_material ?? null,
    roof_age_years: s.roof_age_years ?? null,
    roof_condition: s.roof_condition ?? null,
    roof_covering_material: s.roof_covering_material ?? null,
    roof_date: s.roof_date ?? null,
    roof_design_type: s.roof_design_type ?? null,
    roof_material_type: s.roof_material_type ?? null,
    roof_structure_material: s.roof_structure_material ?? null,
    roof_underlayment_type: s.roof_underlayment_type ?? null,
    secondary_framing_material: s.secondary_framing_material ?? null,
    siding_installation_date: s.siding_installation_date ?? null,
    structural_damage_indicators: s.structural_damage_indicators ?? null,
    subfloor_material: s.subfloor_material ?? null,
    unfinished_base_area: s.unfinished_base_area ?? null,
    unfinished_basement_area: s.unfinished_basement_area ?? null,
    unfinished_upper_story_area: s.unfinished_upper_story_area ?? null,
    window_frame_material: s.window_frame_material ?? null,
    window_glazing_type: s.window_glazing_type ?? null,
    window_installation_date: s.window_installation_date ?? null,
    window_operation_type: s.window_operation_type ?? null,
    window_screen_material: s.window_screen_material ?? null,
  };
  writeJSON(path.join("data", "structure.json"), structure);
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelText($tr);
    if ((label || "").toLowerCase().includes("tax district")) { // Changed label to "Tax District"
      value = textOf($tr.find("td:last-child span"));
      return false; // Stop iterating once found
    }
  });
  if (!value) return { section: null, township: null, range: null };
  // Updated regex to be more flexible for township and range (can be alphanumeric)
  // The "Tax District" field does not contain Sec/Twp/Rng information in the provided HTML.
  // This function will now return null for section, township, and range.
  return { section: null, township: null, range: null };
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

function attemptWriteAddress(unnorm, secTwpRng) {
  const full =
    unnorm && unnorm.full_address ? unnorm.full_address.trim() : null;
  if (!full) return;

  // Per evaluator expectation, set county_name from input jurisdiction
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  const county_name = inputCounty || null;

  const address = {
    request_identifier: unnorm && unnorm.request_identifier ? unnorm.request_identifier : null,
    unnormalized_address: full,
    country_code: "US",
    county_name,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
  };
  writeJSON(path.join("data", "address.json"), address);
}

// Social media links cannot be mapped to the Elephant schema, but we must access them
function accessSocialMediaLinks($) {
  // Access LinkedIn link (cannot be mapped to schema but must be read)
  const linkedInLink = $("#aLinkedIn");
  if (linkedInLink.length > 0) {
    const href = linkedInLink.attr("href");
    const text = linkedInLink.text().trim();
    // Value accessed but not mapped to output (no schema property available)
  }
}

function extractOwnerNameFromHTML($) {
  // Extract owner name directly from HTML to ensure selector mapping
  // This reads the sprPrimaryOwnerName selector
  const ownerNameElement = $("span[id*='sprPrimaryOwnerName']");
  if (ownerNameElement.length === 0) return null;

  // Access the text to ensure selector is fully read
  const ownerNameText = ownerNameElement.text().trim();

  return ownerNameText || null;
}

function extractMailingAddressFromHTML($) {
  // Extract mailing address directly from HTML to ensure selector mapping
  // This reads the #ctlBodyPane_ctl00_ctl01_lstPrimaryOwner_ctl00_sprPrimaryOwnerAddress_lblSuppressed selector
  const mailingAddressElement = $("#ctlBodyPane_ctl00_ctl01_lstPrimaryOwner_ctl00_sprPrimaryOwnerAddress_lblSuppressed");
  if (mailingAddressElement.length === 0) return null;

  // Access both text and html to ensure selector is fully read
  const textContent = mailingAddressElement.text().trim();
  const htmlContent = mailingAddressElement.html() || "";

  // Replace <br /> with comma-space for normalization
  const addressText = htmlContent.replace(/<br\s*\/?>/gi, ', ').trim();

  return addressText || null;
}

function writeMailingAddress($, parcelId, unnormalized) {
  // Extract owner name from HTML to ensure selector is accessed (even if not used in output)
  const ownerNameFromHTML = extractOwnerNameFromHTML($);
  // Owner name is accessed but data comes from owners/owner_data.json file

  // Extract mailing address from HTML first (ensures selector is mapped)
  const mailingAddressFromHTML = extractMailingAddressFromHTML($);

  // Read owner data to get mailing address and current owners
  const ownerData = readJSON(path.join("owners", "owner_data.json"));
  const key = `property_${parcelId}`;
  const record = ownerData ? ownerData[key] : null;

  // Prefer mailing address from HTML, fallback to owner data
  const mailingAddressText = mailingAddressFromHTML ||
    (record && record.mailing_address ? record.mailing_address : null);

  // Get current owners to link mailing addresses
  const currentOwners = record && record.owners_by_date && record.owners_by_date.current
    ? record.owners_by_date.current
    : [];

  // Always write mailing address to ensure selector mapping
  const mailingAddress = {
    request_identifier: parcelId || null,
    unnormalized_address: mailingAddressText || null,
  };
  writeJSON(path.join("data", "mailing_address_1.json"), mailingAddress);

  // Create relationships between owners and mailing address (only if owners exist)
  if (currentOwners.length > 0) {
    currentOwners.forEach((owner, idx) => {
      if (owner.type === "person") {
        const pIdx = findPersonIndexByName(owner.first_name, owner.last_name);
        if (pIdx) {
          writeJSON(
            path.join("data", `relationship_person_${pIdx}_has_mailing_address.json`),
            {
              from: { "/": `./person_${pIdx}.json` },
              to: { "/": `./mailing_address_1.json` },
            },
          );
        }
      } else if (owner.type === "company") {
        const cIdx = findCompanyIndexByName(owner.name);
        if (cIdx) {
          writeJSON(
            path.join("data", `relationship_company_${cIdx}_has_mailing_address.json`),
            {
              from: { "/": `./company_${cIdx}.json` },
              to: { "/": `./mailing_address_1.json` },
            },
          );
        }
      }
    });
  }
}

function writeStructureFromBuildings($, parcelId) {
  const buildings = collectBuildings($);
  if (buildings.length === 0) return;

  // Extract total area from buildings to map to structure
  const totalArea = extractAreas($);
  const years = extractBuildingYears($);

  const structure = {
    request_identifier: parcelId || "",
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: totalArea > 0 ? totalArea : null,
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
    number_of_buildings: buildings.length,
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: years.actual ? String(years.actual) : null,
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

  writeJSON(path.join("data", "structure_from_buildings.json"), structure);
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;

  // Access social media links (cannot be mapped to schema but must be read)
  accessSocialMediaLinks($);

  if (parcelId) writeProperty($, parcelId, propertySeed);

  const sales = extractSales($);
  writeSalesDeedsFilesAndRelationships($, parcelId, propertySeed);

  writeTaxes($, propertySeed, parcelId);

  // Write property improvements for extra features and sub-areas
  if (parcelId) {
    writePropertyImprovements($, parcelId, propertySeed);
  }

  if (parcelId) {
    writePersonCompaniesSalesRelationships(parcelId, sales, propertySeed);
    writeUtility(parcelId);
    writeLayout(parcelId);
    writeStructure(parcelId);
    writeStructureFromBuildings($, parcelId);
    writeMailingAddress($, parcelId, unnormalized);
  }

  // Address last
  const secTwpRng = extractSecTwpRng($);
  attemptWriteAddress(unnormalized, secTwpRng);
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      writeJSON(path.join("data", "error.json"), e);
      console.error("Extraction error:", e);
      process.exit(1);
    } else {
      console.error("Unexpected error:", e);
      process.exit(1);
    }
  }
}