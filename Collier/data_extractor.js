const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function toNumberCurrency(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned.toUpperCase() === "N/A") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseDateToISO(mdyy) {
  if (!mdyy) return null;
  // Accept MM/DD/YY or MM/DD/YYYY
  const m = mdyy.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  let [_, mm, dd, yy] = m;
  let yyyy =
    yy.length === 2
      ? Number(yy) >= 70
        ? 1900 + Number(yy)
        : 2000 + Number(yy)
      : Number(yy);
  return `${yyyy}-${mm}-${dd}`;
}

function extractPropertyType(useCodeText) {
  if (!useCodeText) return null;
  const code = useCodeText.split("-")[0].trim();
  const map = {
    0: "VacantLand",
    1: "SingleFamily",
    2: "MobileHome",
    3: "MultiFamilyMoreThan10",
    4: "Condominium",
    403: "Condominium",
    5: "Cooperative",
    6: "Retirement",
    7: "MiscellaneousResidential",
    8: "MultiFamilyLessThan10",
  };
  const val = map[code];
  if (!val) {
    const err = {
      type: "error",
      message: `Unknown enum value ${code}.`,
      path: "property.property_type",
    };
    throw new Error(JSON.stringify(err));
  }
  return val;
}

function splitStreet(streetPart) {
  const dirs = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  let tokens = streetPart
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let postDir = null;
  if (tokens.length > 1 && dirs.has(tokens[tokens.length - 1].toUpperCase())) {
    postDir = tokens.pop().toUpperCase();
  }
  // Now determine suffix type from last token
  const suffixMap = {
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    RD: "Rd",
    ROAD: "Rd",
    ST: "St",
    STREET: "St",
    LN: "Ln",
    LANE: "Ln",
    DR: "Dr",
    DRIVE: "Dr",
    WAY: "Way",
    WY: "Way",
    TER: "Ter",
    TERRACE: "Ter",
    PL: "Pl",
    PLACE: "Pl",
    CT: "Ct",
    COURT: "Ct",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    CIR: "Cir",
    CIRCLE: "Cir",
    PKWY: "Pkwy",
    PARKWAY: "Pkwy",
    EXPY: "Expy",
    EXPRESSWAY: "Expy",
  };
  let suffix = null;
  if (tokens.length > 1) {
    const rawSuffix = tokens[tokens.length - 1];
    const rawUpper = (rawSuffix || "").toUpperCase();
    if (suffixMap[rawUpper]) {
      suffix = suffixMap[rawUpper];
      tokens = tokens.slice(0, -1); // remove suffix from street_name tokens
    }
  }
  const streetName = tokens.join(" ").toUpperCase();
  return { streetName, postDir, suffix };
}

function parseAddress(
  fullAddress,
  legalText,
  section,
  township,
  range,
  countyNameFromSeed,
) {
  // Example fullAddress: 11532 LONGSHORE WAY W, NAPLES, FL 34119 or 11532 LONGSHORE WAY W, NAPLES 34119
  let streetNumber = null,
    streetName = null,
    postDir = null,
    preDir = null,
    suffixType = null,
    city = null,
    state = null,
    zip = null;

  if (fullAddress) {
    const addr = fullAddress.replace(/\s+,/g, ",").trim();
    // Prefer pattern: <num> <street words> [<postDir>], <CITY>, <STATE> <ZIP>
    let m = addr.match(
      /^(\d+)\s+([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/,
    );
    if (m) {
      streetNumber = m[1];
      const streetPart = m[2].trim();
      city = m[3].trim().toUpperCase();
      state = m[4];
      zip = m[5];
      const parsed = splitStreet(streetPart);
      streetName = parsed.streetName;
      postDir = parsed.postDir;
      suffixType = parsed.suffix;
    } else {
      // Fallback pattern without explicit state: <num> <street words> [<postDir>], <CITY> <ZIP>
      m = addr.match(/^(\d+)\s+([^,]+),\s*([A-Z\s]+)\s*(\d{5})(?:-\d{4})?$/);
      if (m) {
        streetNumber = m[1];
        const streetPart = m[2].trim();
        city = m[3].trim().toUpperCase();
        zip = m[4];
        const parsed = splitStreet(streetPart);
        streetName = parsed.streetName;
        postDir = parsed.postDir;
        suffixType = parsed.suffix;
      }
    }
  }

  // From legal, get block and lot
  let block = null,
    lot = null;
  if (legalText) {
    const b = legalText.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (b) block = b[1].toUpperCase();
    const l = legalText.match(/LOT\s+(\w+)/i);
    if (l) lot = l[1];
  }

  return {
    block: block || null,
    city_name: city || null,
    country_code: null, // do not fabricate
    county_name: countyNameFromSeed || null,
    latitude: null,
    longitude: null,
    lot: lot || null,
    municipality_name: null,
    plus_four_postal_code: null,
    postal_code: zip || null,
    range: range || null,
    route_number: null,
    section: section || null,
    state_code: state || "FL",
    street_name: streetName || null,
    street_number: streetNumber || null,
    street_post_directional_text: postDir || null,
    street_pre_directional_text: preDir || null,
    street_suffix_type: suffixType || null,
    township: township || null,
    unit_identifier: null,
  };
}

function main() {
  const inHtmlPath = path.join("input.html");
  const unaddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inHtmlPath, "utf8");
  const $ = cheerio.load(html);

  const unaddr = readJson(unaddrPath);
  const seed = readJson(seedPath);
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const folio = seed.request_identifier || seed.parcel_id;

  // Extract base fields from HTML
  const parcelId =
    $("#ParcelID").first().text().trim() || seed.parcel_id || folio;
  const fullAddressHtml = $("#FullAddressUnit").first().text().trim();
  const fullAddressUn = unaddr.full_address || null;
  const fullAddress = fullAddressUn || fullAddressHtml || null;
  const legalText = $("#Legal").first().text().trim() || null;
  const subdivisionRaw = $("#SCDescription").first().text().trim() || null; // e.g., 469900 - LONGSHORE LAKE UNIT 1
  const subdivision = subdivisionRaw
    ? subdivisionRaw.replace(/^\s*\d+\s*-\s*/, "").trim()
    : null;
  const useCodeText = $("#UCDescription").first().text().trim();

  const section = $("#Section").first().text().trim() || null;
  const township = $("#Township").first().text().trim() || null;
  const range = $("#Range").first().text().trim() || null;

  // Property JSON
  const property = {
    livable_floor_area: null,
    parcel_identifier: parcelId,
    property_legal_description_text: legalText,
    property_structure_built_year: null,
    property_type: null,
    area_under_air: null,
    historic_designation: undefined,
    number_of_units: null,
    number_of_units_type: null,
    property_effective_built_year: null,
    subdivision: subdivision || null,
    total_area: null,
    zoning: null,
  };

  // property_type
  if (useCodeText) {
    property.property_type = extractPropertyType(useCodeText);
  }

  // Year built and areas from Building/Extra Features
  let yearBuilt = null,
    baseArea = null,
    adjArea = null;
  $("#BuildingAdditional tr").each((i, el) => {
    const desc =
      $(el)
        .find("#BLDGCLASS" + (i + 1))
        .text()
        .trim() || $(el).find("span[id^=BLDGCLASS]").text().trim();
    const yr = $(el).find("span[id^=YRBUILT]").text().trim();
    const base = $(el).find("span[id^=BASEAREA]").text().trim();
    const adj = $(el).find("span[id^=TYADJAREA]").text().trim();
    if (/SINGLE\s+FAMILY\s+RESIDENCE/i.test(desc)) {
      if (yr) yearBuilt = parseInt(yr, 10);
      if (base) baseArea = base;
      if (adj) adjArea = adj;
    }
  });
  if (!yearBuilt) {
    const yr = $("#BuildingAdditional tr")
      .first()
      .find("span[id^=YRBUILT]")
      .text()
      .trim();
    if (yr) yearBuilt = parseInt(yr, 10);
  }
  if (yearBuilt) property.property_structure_built_year = yearBuilt;
  if (baseArea) {
    property.livable_floor_area = String(baseArea);
    property.area_under_air = String(baseArea);
  }
  if (adjArea) {
    property.total_area = String(adjArea);
  }

  // Write property.json
  fs.writeFileSync(
    path.join(dataDir, "property.json"),
    JSON.stringify(property, null, 2),
  );

  // Address
  const countyName =
    unaddr.county_jurisdiction === "Collier"
      ? "Collier"
      : unaddr.county_jurisdiction || null;
  const addressObj = parseAddress(
    fullAddress,
    legalText,
    section,
    township,
    range,
    countyName,
  );
  fs.writeFileSync(
    path.join(dataDir, "address.json"),
    JSON.stringify(addressObj, null, 2),
  );

  // Sales + Deeds - from Summary sales table
  const saleRows = [];
  $("#SalesAdditional tr").each((i, el) => {
    const $row = $(el);
    const dateTxt = $row.find("span[id^=SaleDate]").text().trim();
    const amtTxt = $row.find("span[id^=SaleAmount]").text().trim();
    const bookPage = $row.find("a").first().text().trim() || null;
    const row = {
      rowIndex: i + 1,
      dateTxt,
      iso: parseDateToISO(dateTxt),
      amount: toNumberCurrency(amtTxt),
      bookPage,
    };
    saleRows.push(row);
  });

  // Create deed and file files for every sale row (even $0)
  saleRows.forEach((row, idx) => {
    const deedObj = {};
    fs.writeFileSync(
      path.join(dataDir, `deed_${idx + 1}.json`),
      JSON.stringify(deedObj, null, 2),
    );

    const fileObj = {
      file_format: null, // unknown (pdf not in enum)
      name: row.bookPage || null,
      original_url: null, // not provided (javascript: link only)
      ipfs_url: null,
      document_type: "ConveyanceDeed",
    };
    fs.writeFileSync(
      path.join(dataDir, `file_${idx + 1}.json`),
      JSON.stringify(fileObj, null, 2),
    );

    const relDf = {
      to: { "/": `./deed_${idx + 1}.json` },
      from: { "/": `./file_${idx + 1}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_deed_file_${idx + 1}.json`),
      JSON.stringify(relDf, null, 2),
    );
  });

  // Create sales files only for positive amounts
  const positiveSales = saleRows.filter(
    (r) => r.amount != null && r.amount > 0 && r.iso,
  );
  positiveSales.sort((a, b) => a.iso.localeCompare(b.iso));
  positiveSales.forEach((s, idx) => {
    const saleObj = {
      ownership_transfer_date: s.iso,
      purchase_price_amount: s.amount,
    };
    fs.writeFileSync(
      path.join(dataDir, `sales_${idx + 1}.json`),
      JSON.stringify(saleObj, null, 2),
    );
  });

  // Relationship: sales -> deed for rows with positive sales (map to original row index)
  positiveSales.forEach((s, idx) => {
    const orig = saleRows.findIndex(
      (r) => r.iso === s.iso && r.amount === s.amount,
    );
    if (orig !== -1) {
      const deedIdx = orig + 1;
      const rel = {
        to: { "/": `./sales_${idx + 1}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_sales_deed_${idx + 1}.json`),
        JSON.stringify(rel, null, 2),
      );
    }
  });

  // Owners (company/person) from owners/owner_data.json
  const ownerKey = `property_${folio}`;
  const ownerEntry = owners[ownerKey];
  if (
    ownerEntry &&
    ownerEntry.owners_by_date &&
    Array.isArray(ownerEntry.owners_by_date.current)
  ) {
    const curr = ownerEntry.owners_by_date.current;
    if (curr.length > 0) {
      // Cleanup any legacy duplicate relationship files
      const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.startsWith("relationship_sales_company"));
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(dataDir, f));
        } catch (_) {}
      }

      const first = curr[0];
      if (first.type === "company") {
        curr.forEach((c, i) => {
          const comp = { name: c.name || null };
          fs.writeFileSync(
            path.join(dataDir, `company_${i + 1}.json`),
            JSON.stringify(comp, null, 2),
          );
        });
        // Link each current owner to each positive sale event (one link per sale per owner)
        if (positiveSales.length > 0) {
          positiveSales.forEach((s, si) => {
            curr.forEach((c, oi) => {
              const rel = {
                to: { "/": `./company_${oi + 1}.json` },
                from: { "/": `./sales_${si + 1}.json` },
              };
              fs.writeFileSync(
                path.join(
                  dataDir,
                  `relationship_sales_company_${oi + 1}_${si + 1}.json`,
                ),
                JSON.stringify(rel, null, 2),
              );
            });
          });
        }
      } else if (first.type === "person") {
        curr.forEach((p, i) => {
          const person = {
            birth_date: p.birth_date || null,
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            middle_name: p.middle_name || null,
            prefix_name: p.prefix_name || null,
            suffix_name: p.suffix_name || null,
            us_citizenship_status: p.us_citizenship_status || null,
            veteran_status: p.veteran_status != null ? p.veteran_status : null,
          };
          fs.writeFileSync(
            path.join(dataDir, `person_${i + 1}.json`),
            JSON.stringify(person, null, 2),
          );
        });
        if (positiveSales.length > 0) {
          positiveSales.forEach((s, si) => {
            curr.forEach((c, oi) => {
              const rel = {
                to: { "/": `./person_${oi + 1}.json` },
                from: { "/": `./sales_${si + 1}.json` },
              };
              fs.writeFileSync(
                path.join(
                  dataDir,
                  `relationship_sales_person_${oi + 1}_${si + 1}.json`,
                ),
                JSON.stringify(rel, null, 2),
              );
            });
          });
        }
      }
    }
  }

  // Utilities from owners/utilities_data.json
  const utilsEntry = utils[ownerKey];
  if (utilsEntry) {
    fs.writeFileSync(
      path.join(dataDir, "utility.json"),
      JSON.stringify(utilsEntry, null, 2),
    );
  }

  // Layouts from owners/layout_data.json
  const layoutEntry = layouts[ownerKey];
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    let idx = 1;
    for (const lay of layoutEntry.layouts) {
      if (lay && Object.keys(lay).length > 0) {
        fs.writeFileSync(
          path.join(dataDir, `layout_${idx}.json`),
          JSON.stringify(lay, null, 2),
        );
        idx++;
      }
    }
  }

  // Tax from Summary and History
  // From Summary (preliminary/current)
  let rollType = (
    $("#RollType").first().text().trim() ||
    $("#RollType2").first().text().trim() ||
    ""
  ).toUpperCase();
  let ty = null;
  const mYear = rollType.match(/(\d{4})/);
  if (mYear) ty = parseInt(mYear[1], 10);
  const land = toNumberCurrency($("#LandJustValue").first().text());
  const impr = toNumberCurrency($("#ImprovementsJustValue").first().text());
  const just = toNumberCurrency($("#TotalJustValue").first().text());
  let assessed = toNumberCurrency(
    $("#TdDetailCountyAssessedValue").first().text(),
  );
  if (assessed == null) {
    assessed = toNumberCurrency(
      $("#HistorySchoolAssessedValue1").first().text(),
    );
  }
  let taxable = toNumberCurrency($("#CountyTaxableValue").first().text());
  if (taxable == null)
    taxable = toNumberCurrency($("#TdDetailCountyTaxableValue").first().text());
  let yearly = toNumberCurrency($("#TotalTaxes").first().text());
  if (yearly == null)
    yearly = toNumberCurrency(
      $("#TblAdValoremAdditionalTotal #TotalAdvTaxes").first().text(),
    );

  if (ty != null && (land != null || impr != null || just != null)) {
    const monthly = yearly != null ? round2(yearly / 12) : null;
    const taxObj = {
      tax_year: ty,
      property_assessed_value_amount:
        assessed != null ? assessed : just != null ? just : null,
      property_market_value_amount:
        just != null ? just : assessed != null ? assessed : null,
      property_building_amount: impr != null ? impr : null,
      property_land_amount: land != null ? land : null,
      property_taxable_value_amount:
        taxable != null ? taxable : assessed != null ? assessed : null,
      monthly_tax_amount: monthly,
      period_end_date: ty ? `${ty}-12-31` : null,
      period_start_date: ty ? `${ty}-01-01` : null,
      yearly_tax_amount: yearly != null ? yearly : null,
    };
    fs.writeFileSync(
      path.join(dataDir, "tax_1.json"),
      JSON.stringify(taxObj, null, 2),
    );
  }

  // From History (Tab6) for multiple years
  const years = [];
  for (let idx = 1; idx <= 5; idx++) {
    const yTxt = $(`#HistoryTaxYear${idx}`).text().trim();
    let yNum = null;
    const my = yTxt.match(/(\d{4})/);
    if (my) yNum = parseInt(my[1], 10);
    if (!yNum) continue;

    const landH = toNumberCurrency($(`#HistoryLandJustValue${idx}`).text());
    const imprH = toNumberCurrency(
      $(`#HistoryImprovementsJustValue${idx}`).text(),
    );
    const justH = toNumberCurrency($(`#HistoryTotalJustValue${idx}`).text());
    const assessedH = toNumberCurrency(
      $(`#HistorySchoolAssessedValue${idx}`).text(),
    );
    const taxableH = toNumberCurrency(
      $(`#HistoryCountyTaxableValue${idx}`).text(),
    );
    const yearlyH = toNumberCurrency($(`#HistoryTotalTaxes${idx}`).text());

    if (yNum && (landH != null || imprH != null || justH != null)) {
      years.push({
        idx,
        yNum,
        landH,
        imprH,
        justH,
        assessedH,
        taxableH,
        yearlyH,
      });
    }
  }
  years.forEach((rec) => {
    const monthly = rec.yearlyH != null ? round2(rec.yearlyH / 12) : null;
    const taxObj = {
      tax_year: rec.yNum,
      property_assessed_value_amount:
        rec.assessedH != null
          ? rec.assessedH
          : rec.justH != null
            ? rec.justH
            : null,
      property_market_value_amount:
        rec.justH != null
          ? rec.justH
          : rec.assessedH != null
            ? rec.assessedH
            : null,
      property_building_amount: rec.imprH != null ? rec.imprH : null,
      property_land_amount: rec.landH != null ? rec.landH : null,
      property_taxable_value_amount:
        rec.taxableH != null
          ? rec.taxableH
          : rec.assessedH != null
            ? rec.assessedH
            : null,
      monthly_tax_amount: monthly,
      period_end_date: `${rec.yNum}-12-31`,
      period_start_date: `${rec.yNum}-01-01`,
      yearly_tax_amount: rec.yearlyH != null ? rec.yearlyH : null,
    };
    const outIdx = rec.idx; // 1..5 corresponds to 2025..2021
    fs.writeFileSync(
      path.join(dataDir, `tax_${outIdx}.json`),
      JSON.stringify(taxObj, null, 2),
    );
  });
}

try {
  main();
  console.log("Extraction completed");
} catch (e) {
  try {
    const obj = JSON.parse(e.message);
    if (obj && obj.type === "error") {
      console.error(JSON.stringify(obj));
      process.exit(1);
    }
  } catch (_) {}
  console.error(e.stack || e.message || String(e));
  process.exit(1);
}
