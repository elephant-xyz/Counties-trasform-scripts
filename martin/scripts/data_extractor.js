const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function readJson(p) {
  return JSON.parse(readText(p));
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toISODate(mdY) {
  if (!mdY) return null;
  const parts = mdY
    .trim()
    .split(/[\/\-]/)
    .map((s) => s.trim());
  if (parts.length < 3) return null;
  let [m, d, y] = parts;
  m = parseInt(m, 10);
  d = parseInt(d, 10);
  y = parseInt(y, 10);
  if (y < 100) {
    y = y >= 50 ? 1900 + y : 2000 + y;
  }
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function parseCurrencyToNumber(text) {
  if (text == null) return null;
  const cleaned = String(text).replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return null;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100) / 100;
}

function titleCaseName(s) {
  if (s == null) return null;
  s = String(s).toLowerCase();
  return s.replace(
    /(^|[\s\-\'])([a-z])/g,
    (m, p1, p2) => p1 + p2.toUpperCase(),
  );
}

function getValueByStrong($, label) {
  let out = null;
  $("td > strong").each((i, el) => {
    const t = $(el).text().trim();
    if (t.toLowerCase() === String(label).toLowerCase()) {
      const td = $(el).parent();
      const clone = td.clone();
      clone.children("strong").remove();
      let text = clone.text().replace(/\s+/g, " ").trim();
      out = text;
      return false;
    }
  });
  return out;
}

function errorUnknownEnum(value, cls, prop) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: `${cls}.${prop}`,
  };
  throw new Error(JSON.stringify(err));
}

function mapPropertyType(useCodeText) {
  if (!useCodeText) return null;
  const t = useCodeText.toLowerCase();
  if (t.includes("single family")) return "SingleFamily";
  if (t.includes("duplex")) return "Duplex";
  if (t.includes("triplex")) return "3Units";
  if (t.includes("quad")) return "4Units";
  if (t.includes("condo")) return "Condominium";
  if (t.includes("town")) return "Townhouse";
  return null;
}

function mapUnitsType(units) {
  if (units == null) return null;
  const u = parseInt(units, 10);
  if (u === 1) return "One";
  if (u === 2) return "Two";
  if (u === 3) return "Three";
  if (u === 4) return "Four";
  return null;
}

function mapStreetSuffixType(suf) {
  if (!suf) return null;
  const m = {
    ALLEY: "Aly",
    ALY: "Aly",
    AVE: "Ave",
    AVENUE: "Ave",
    BLVD: "Blvd",
    BOULEVARD: "Blvd",
    CIR: "Cir",
    CIRCLE: "Cir",
    COURT: "Ct",
    CT: "Ct",
    DR: "Dr",
    DRIVE: "Dr",
    HWY: "Hwy",
    HIGHWAY: "Hwy",
    LN: "Ln",
    LANE: "Ln",
    PKWY: "Pkwy",
    RD: "Rd",
    ROAD: "Rd",
    RDS: "Rds",
    ST: "St",
    STREET: "St",
    TER: "Ter",
    TERRACE: "Ter",
    WAY: "Way",
    PL: "Pl",
    PLAZA: "Plz",
    PLZ: "Plz",
    TRCE: "Trce",
    TRL: "Trl",
    TRAIL: "Trl",
    XING: "Xing",
    KY: "Ky",
    VW: "Vw",
    RUN: "Run",
    MALL: "Mall",
    PASS: "Pass",
    ROW: "Row",
    LOOP: "Loop",
    WALK: "Walk",
    PT: "Pt",
    PINES: "Pnes",
    PTS: "Pts",
  };
  const key = String(suf).trim().toUpperCase();
  const v = m[key] || null;
  if (!v) {
    errorUnknownEnum(suf, "address", "street_suffix_type");
  }
  return v;
}

function mapDeedType(raw) {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "warranty deed") return "Warranty Deed";
  if (t === "special warranty deed") return "Special Warranty Deed";
  if (t === "quitclaim deed" || t === "qu" || t.startsWith("quit claim"))
    return "Quitclaim Deed";
  if (t.includes("full covenant") && t.includes("warranty"))
    return "Warranty Deed";
  errorUnknownEnum(raw, "deed", "deed_type");
}

function mapDocTypeForFile(deedType) {
  if (deedType === "Warranty Deed") return "ConveyanceDeedWarrantyDeed";
  if (deedType === "Quitclaim Deed") return "ConveyanceDeedQuitClaimDeed";
  if (deedType === "Special Warranty Deed") return "ConveyanceDeed";
  return "ConveyanceDeed";
}

function mapRoofCovering(raw) {
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (t.includes("comp sh")) return "3-Tab Asphalt Shingle";
  if (t.includes("3-tab")) return "3-Tab Asphalt Shingle";
  if (t.includes("arch")) return "Architectural Asphalt Shingle";
  return null;
}

function cleanNum(text) {
  if (text == null) return null;
  const only = String(text).replace(/[^0-9]/g, "");
  if (only === "") return null;
  return parseInt(only, 10);
}

function main() {
  const inputHtmlPath = "input.html";
  const addrPath = "unnormalized_address.json";
  const seedPath = "property_seed.json";
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = readText(inputHtmlPath);
  const $ = cheerio.load(html);
  const addr = readJson(addrPath);
  const seed = readJson(seedPath);
  const ownersData = readJson(ownersPath);
  const utilitiesData = readJson(utilsPath);
  const layoutData = readJson(layoutPath);

  ensureDir("data");

  // Address
  let fullAddress = addr.full_address || getValueByStrong($, "Situs Address");
  let city = null,
    state = null,
    zip = null,
    street_number = null,
    preDir = null,
    street_name = null,
    suf = null;
  if (fullAddress) {
    const m = fullAddress.match(
      /^(\d+)\s+([NSEW]{1,2})?\s*([^,]+?)\s+([A-Za-z\.]+)\s*,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i,
    );
    if (m) {
      street_number = m[1];
      preDir = m[2] ? m[2].toUpperCase() : null;
      const streetCore = m[3].trim();
      street_name = streetCore.replace(/\s+/g, " ");
      suf = m[4];
      city = m[5].trim().toUpperCase();
      state = m[6].toUpperCase();
      zip = m[7];
    } else {
      const parts = fullAddress.replace(/,/g, "").trim().split(/\s+/);
      street_number = parts[0] || null;
      if (
        ["N", "S", "E", "W", "NE", "NW", "SE", "SW"].includes(
          (parts[1] || "").toUpperCase(),
        )
      ) {
        preDir = parts[1].toUpperCase();
        street_name = parts.slice(2, parts.length - 3).join(" ");
      } else {
        street_name = parts.slice(1, parts.length - 3).join(" ");
      }
      const nParts = street_name ? street_name.split(" ") : [];
      suf = nParts.pop();
      street_name = nParts.join(" ");
      city = (parts[parts.length - 3] || "").toUpperCase();
      state = (parts[parts.length - 2] || "").toUpperCase();
      zip = parts[parts.length - 1] || null;
    }
  }
  let street_suffix_type = null;
  if (suf) {
    street_suffix_type = mapStreetSuffixType(suf);
  }
  let latitude = null,
    longitude = null;
  const gmHref = $("a.property-google-maps").attr("href");
  if (gmHref) {
    const mm = gmHref.match(/viewpoint=([-0-9\.]+),([-0-9\.]+)/);
    if (mm) {
      latitude = parseFloat(mm[1]);
      longitude = parseFloat(mm[2]);
    }
  }
  const addressOut = {
    street_number: street_number || null,
    street_pre_directional_text: preDir || null,
    street_name: street_name ? street_name.replace(/\s+/g, " ") : null,
    street_suffix_type: street_suffix_type || null,
    street_post_directional_text: null,
    city_name: city || null,
    state_code: state || null,
    postal_code: zip || null,
    plus_four_postal_code: null,
    country_code: addr && addr.county_jurisdiction ? "US" : null,
    county_name:
      addr.county_jurisdiction === "Martin"
        ? "Martin"
        : addr.county_jurisdiction || null,
    unit_identifier: null,
    latitude: latitude || null,
    longitude: longitude || null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    block: null,
    lot: null,
    municipality_name: null,
  };
  writeJson(path.join("data", "address.json"), addressOut);

  // Property
  const parcelId =
    getValueByStrong($, "Parcel ID") ||
    seed.parcel_id ||
    seed.parcelIdentifier ||
    null;
  const useCodeText = getValueByStrong($, "Use Code/Property Class") || "";
  const propertyType = mapPropertyType(useCodeText);
  if (!propertyType) {
    errorUnknownEnum(useCodeText, "property", "property_type");
  }

  let livable =
    getValueByStrong($, "Total Finished Area") ||
    getValueByStrong($, "Finished Area") ||
    null;
  const yearBuiltText = getValueByStrong($, "Year Built");
  const yearBuilt = yearBuiltText
    ? parseInt(yearBuiltText.replace(/[^0-9]/g, ""), 10)
    : null;
  const numUnitsText = getValueByStrong($, "Number of Units");
  const numUnits = numUnitsText
    ? parseInt(numUnitsText.replace(/[^0-9]/g, ""), 10)
    : null;
  const unitsType = mapUnitsType(numUnits);
  if (unitsType == null) {
    errorUnknownEnum(
      String(numUnitsText || ""),
      "property",
      "number_of_units_type",
    );
  }

  // Full legal description without disclaimer
  let legalFull = null;
  const legalTd = $("div.table-section.full-legal-description td").first();
  if (legalTd && legalTd.length) {
    const clone = legalTd.clone();
    clone.find(".legal-disclaimer").remove();
    legalFull = clone.text().replace(/\s+/g, " ").trim();
  } else {
    const legalShort = getValueByStrong($, "Legal Description");
    legalFull = legalShort || null;
  }

  const neighborhood = getValueByStrong($, "Neighborhood");

  const propertyOut = {
    parcel_identifier: parcelId,
    property_type: propertyType,
    property_structure_built_year: yearBuilt || null,
    property_effective_built_year: null,
    livable_floor_area: livable || null,
    area_under_air: livable || null,
    total_area: null,
    number_of_units: numUnits || null,
    number_of_units_type: unitsType,
    property_legal_description_text: legalFull || null,
    subdivision: neighborhood || null,
    zoning: null,
    historic_designation: undefined,
  };
  Object.keys(propertyOut).forEach((k) => {
    if (propertyOut[k] === undefined) delete propertyOut[k];
  });
  writeJson(path.join("data", "property.json"), propertyOut);

  // Lot
  const legalAcresText = getValueByStrong($, "Legal Acres");
  let lotSizeAcre = legalAcresText
    ? parseFloat(legalAcresText.replace(/[^0-9.]/g, ""))
    : null;
  if (isNaN(lotSizeAcre)) lotSizeAcre = null;
  let lotAreaSqft = null;
  if (lotSizeAcre != null) {
    lotAreaSqft = Math.round(lotSizeAcre * 43560);
  }
  let lotType = null;
  if (lotSizeAcre != null) {
    lotType =
      lotSizeAcre <= 0.25
        ? "LessThanOrEqualToOneQuarterAcre"
        : "GreaterThanOneQuarterAcre";
  }

  const lotOut = {
    lot_type: lotType || null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: lotAreaSqft || null,
    lot_size_acre: lotSizeAcre || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJson(path.join("data", "lot.json"), lotOut);

  // Taxes
  const taxes = [];
  const currentValueBlock = $("div.table-section.current-value");
  if (currentValueBlock.length) {
    const tds = currentValueBlock.find("td");
    const row = {};
    tds.each((i, td) => {
      const strong = $(td).find("strong").text().trim();
      const text = $(td).text().replace(strong, "").trim();
      if (strong) row[strong] = text;
    });
    const year = parseInt(row["Year"], 10);
    if (!isNaN(year)) {
      taxes.push({
        tax_year: year,
        property_land_amount: parseCurrencyToNumber(row["Land Value"]),
        property_building_amount: parseCurrencyToNumber(
          row["Improvement Value"],
        ),
        property_market_value_amount: parseCurrencyToNumber(
          row["Market Value"],
        ),
        property_assessed_value_amount: parseCurrencyToNumber(
          row["Assessed Value"],
        ),
        property_taxable_value_amount: parseCurrencyToNumber(
          row["County Taxable Value"],
        ),
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: null,
      });
    }
  }
  $("div.value-history-table table tr").each((i, tr) => {
    if (i === 0) return;
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length >= 8) {
      const year = parseInt($(tds[0]).text().trim(), 10);
      if (!isNaN(year)) {
        taxes.push({
          tax_year: year,
          property_land_amount: parseCurrencyToNumber($(tds[1]).text()),
          property_building_amount: parseCurrencyToNumber($(tds[2]).text()),
          property_market_value_amount: parseCurrencyToNumber($(tds[3]).text()),
          property_assessed_value_amount: parseCurrencyToNumber(
            $(tds[5]).text(),
          ),
          property_taxable_value_amount: parseCurrencyToNumber(
            $(tds[7]).text(),
          ),
          monthly_tax_amount: null,
          period_start_date: null,
          period_end_date: null,
          yearly_tax_amount: null,
        });
      }
    }
  });
  const seenYears = new Set();
  taxes.forEach((t) => {
    if (seenYears.has(t.tax_year)) return;
    seenYears.add(t.tax_year);
    writeJson(path.join("data", `tax_${t.tax_year}.json`), t);
  });

  // Sales / Deeds / Files
  const salesRows = [];
  $("div.sale-history-table table tr").each((i, tr) => {
    if (i === 0) return;
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length >= 6) {
      const saleDate = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const grantor = $(tds[2]).text().trim();
      const deedTypeRaw = $(tds[3]).text().trim();
      const docNum = $(tds[4]).text().trim();
      const linkA = $(tds[5]).find("a");
      const bookPageText = linkA.text().trim();
      const link = linkA.attr("href") || null;
      salesRows.push({
        saleDate,
        priceTxt,
        grantor,
        deedTypeRaw,
        docNum,
        bookPageText,
        link,
      });
    }
  });

  const salesOut = [];
  const deedsOut = [];
  const filesOut = [];
  const relSalesDeed = [];
  const relDeedFile = [];

  salesRows.forEach((row) => {
    const isoDate = toISODate(row.saleDate);
    const price = parseCurrencyToNumber(row.priceTxt);
    const deedType = row.deedTypeRaw ? mapDeedType(row.deedTypeRaw) : null;

    const saleIndex = salesOut.length + 1;
    const deedIndex = deedsOut.length + 1;

    const saleObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: price ?? null,
    };
    salesOut.push({ file: `sales_${saleIndex}.json`, data: saleObj });

    const deedObj = {};
    if (deedType) {
      deedObj.deed_type = deedType;
    }
    deedsOut.push({ file: `deed_${deedIndex}.json`, data: deedObj });

    relSalesDeed.push({
      to: { "/": `./sales_${saleIndex}.json` },
      from: { "/": `./deed_${deedIndex}.json` },
    });

    if (row.link) {
      const fileIndex = filesOut.length + 1;
      const docType = mapDocTypeForFile(deedType || null);
      const name = row.bookPageText
        ? `Book ${row.bookPageText.replace(/\s+/g, " ").trim().replace(" ", " Page ")}`
        : `Deed ${saleIndex}`;
      const fileObj = {
        document_type: docType,
        file_format: null,
        ipfs_url: null,
        name: name,
        original_url: row.link,
      };
      filesOut.push({ file: `file_${fileIndex}.json`, data: fileObj });
      relDeedFile.push({
        to: { "/": `./deed_${deedIndex}.json` },
        from: { "/": `./file_${fileIndex}.json` },
      });
    }
  });

  salesOut.forEach((s) => writeJson(path.join("data", s.file), s.data));
  deedsOut.forEach((d) => writeJson(path.join("data", d.file), d.data));
  filesOut.forEach((f) => writeJson(path.join("data", f.file), f.data));
  if (relSalesDeed.length) {
    writeJson(path.join("data", "relationship_sales_deed.json"), relSalesDeed);
  }
  if (relDeedFile.length) {
    writeJson(path.join("data", "relationship_deed_file.json"), relDeedFile);
  }

  // Owners and relationships
  const parcelKey = `property_${seed.parcel_id || seed.request_identifier || ""}`;
  const acctKey = `property_${seed.request_identifier}`;
  const ownersRoot =
    ownersData[parcelKey] ||
    ownersData[acctKey] ||
    ownersData[Object.keys(ownersData)[0]];
  const ownersByDate =
    ownersRoot && ownersRoot.owners_by_date ? ownersRoot.owners_by_date : {};

  const personMap = new Map();
  const persons = [];
  function personKey(p) {
    return [p.first_name || "", p.middle_name || "", p.last_name || ""]
      .join("|")
      .toLowerCase();
  }
  function addPerson(p) {
    const k = personKey(p);
    if (personMap.has(k)) return personMap.get(k);
    const idx = persons.length + 1;
    const first = titleCaseName(p.first_name);
    const last = titleCaseName(p.last_name);
    const middle = p.middle_name ? titleCaseName(p.middle_name) : null;
    const personObj = {
      birth_date: null,
      first_name: first,
      last_name: last,
      middle_name: middle,
      prefix_name: null,
      suffix_name: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const file = `person_${idx}.json`;
    persons.push({ file, data: personObj, k });
    personMap.set(k, file);
    return file;
  }
  Object.keys(ownersByDate).forEach((dateKey) => {
    (ownersByDate[dateKey] || []).forEach((o) => {
      if (o.type === "person") addPerson(o);
    });
  });
  persons.forEach((p) => writeJson(path.join("data", p.file), p.data));

  const companies = [];
  const companyMap = new Map();
  const currentOwners = ownersByDate["current"] || [];
  currentOwners
    .filter((o) => o.type === "company" && o.name)
    .forEach((o) => {
      const name = o.name;
      if (companyMap.has(name)) return;
      const idx = companies.length + 1;
      const companyObj = { name };
      const file = `company_${idx}.json`;
      companies.push({ file, data: companyObj, name });
      companyMap.set(name, file);
    });
  companies.forEach((c) => writeJson(path.join("data", c.file), c.data));

  // Relationships
  const relSalesPersons = [];
  const relSalesCompanies = [];

  // Link latest sale to current owners (prefer company if present)
  const parseISO = (s) => (s ? new Date(s).getTime() : 0);
  let latestIdx = -1,
    latestTs = -1;
  salesOut.forEach((sObj, i) => {
    const ts = parseISO(sObj.data.ownership_transfer_date);
    if (ts > latestTs) {
      latestTs = ts;
      latestIdx = i;
    }
  });
  if (latestIdx >= 0) {
    const sObj = salesOut[latestIdx];
    const companiesHere = currentOwners.filter((o) => o.type === "company");
    if (companiesHere.length) {
      companiesHere.forEach((c) => {
        const cFile = companyMap.get(c.name);
        if (cFile) {
          relSalesCompanies.push({
            to: { "/": `./${cFile}` },
            from: { "/": `./${sObj.file}` },
          });
        }
      });
    } else {
      currentOwners
        .filter((o) => o.type === "person")
        .forEach((o) => {
          const file = personMap.get(personKey(o));
          if (file) {
            relSalesPersons.push({
              to: { "/": `./${file}` },
              from: { "/": `./${sObj.file}` },
            });
          }
        });
    }
  }

  // Chain-based buyers: for each non-latest sale, link to next sale's sellers (owners_by_date at next sale date), but avoid linking when next seller equals current seller (no transfer)
  const combined = salesOut
    .map((sObj, idx) => ({
      file: sObj.file,
      iso: sObj.data.ownership_transfer_date,
      seller: (salesRows[idx] && salesRows[idx].grantor
        ? salesRows[idx].grantor
        : ""
      )
        .toUpperCase()
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((x) => x.iso);
  combined.sort((a, b) => new Date(a.iso) - new Date(b.iso));
  for (let i = 0; i < combined.length - 1; i++) {
    const curr = combined[i];
    const next = combined[i + 1];
    if (!next.iso) continue;
    if (next.seller && curr.seller && next.seller === curr.seller) continue; // same seller -> ambiguous, skip
    const buyers = ownersByDate[next.iso] || [];
    const personsHere = buyers.filter((o) => o.type === "person");
    personsHere.forEach((p) => {
      const pFile = personMap.get(personKey(p));
      if (pFile) {
        relSalesPersons.push({
          to: { "/": `./${pFile}` },
          from: { "/": `./${curr.file}` },
        });
      }
    });
  }

  writeJson(
    path.join("data", "relationship_sales_person.json"),
    relSalesPersons,
  );
  if (relSalesCompanies.length) {
    writeJson(
      path.join("data", "relationship_sales_company.json"),
      relSalesCompanies,
    );
  }

  // Utilities
  const utilsRoot =
    utilitiesData[acctKey] ||
    utilitiesData[parcelKey] ||
    utilitiesData[Object.keys(utilitiesData)[0]] ||
    {};
  const utilityOut = {
    cooling_system_type: utilsRoot.cooling_system_type ?? null,
    heating_system_type: utilsRoot.heating_system_type ?? null,
    public_utility_type:
      utilsRoot.public_ility_type ?? utilsRoot.public_utility_type ?? null,
    sewer_type: utilsRoot.sewer_type ?? null,
    water_source_type: utilsRoot.water_source_type ?? null,
    plumbing_system_type: utilsRoot.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      utilsRoot.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: utilsRoot.electrical_panel_capacity ?? null,
    electrical_wiring_type: utilsRoot.electrical_wiring_type ?? null,
    hvac_condensing_unit_present:
      utilsRoot.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      utilsRoot.electrical_wiring_type_other_description ?? null,
    solar_panel_present: utilsRoot.solar_panel_present ?? null,
    solar_panel_type: utilsRoot.solar_panel_type ?? null,
    solar_panel_type_other_description:
      utilsRoot.solar_panel_type_other_description ?? null,
    smart_home_features: utilsRoot.smart_home_features ?? null,
    smart_home_features_other_description:
      utilsRoot.smart_home_features_other_description ?? null,
    hvac_unit_condition: utilsRoot.hvac_unit_condition ?? null,
    solar_inverter_visible: utilsRoot.solar_inverter_visible ?? null,
    hvac_unit_issues: utilsRoot.hvac_unit_issues ?? null,
    electrical_panel_installation_date:
      utilsRoot.electrical_panel_installation_date ?? null,
    electrical_rewire_date: utilsRoot.electrical_rewire_date ?? null,
    hvac_capacity_kw: utilsRoot.hvac_capacity_kw ?? null,
    hvac_capacity_tons: utilsRoot.hvac_capacity_tons ?? null,
    hvac_equipment_component: utilsRoot.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: utilsRoot.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: utilsRoot.hvac_equipment_model ?? null,
    hvac_installation_date: utilsRoot.hvac_installation_date ?? null,
    hvac_seer_rating: utilsRoot.hvac_seer_rating ?? null,
    hvac_system_configuration: utilsRoot.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      utilsRoot.plumbing_system_installation_date ?? null,
    sewer_connection_date: utilsRoot.sewer_connection_date ?? null,
    solar_installation_date: utilsRoot.solar_installation_date ?? null,
    solar_inverter_installation_date:
      utilsRoot.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: utilsRoot.solar_inverter_manufacturer ?? null,
    solar_inverter_model: utilsRoot.solar_inverter_model ?? null,
    water_connection_date: utilsRoot.water_connection_date ?? null,
    water_heater_installation_date:
      utilsRoot.water_heater_installation_date ?? null,
    water_heater_manufacturer: utilsRoot.water_heater_manufacturer ?? null,
    water_heater_model: utilsRoot.water_heater_model ?? null,
    well_installation_date: utilsRoot.well_installation_date ?? null,
  };
  writeJson(path.join("data", "utility.json"), utilityOut);

  // Layouts
  const layoutRoot =
    layoutData[acctKey] ||
    layoutData[parcelKey] ||
    layoutData[Object.keys(layoutData)[0]] ||
    {};
  const layouts = layoutRoot.layouts || [];
  layouts.forEach((l, i) => {
    const out = {
      space_type: l.space_type ?? null,
      space_index: l.space_index,
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
      bathroom_renovation_date: l.bathroom_renovation_date ?? null,
      kitchen_renovation_date: l.kitchen_renovation_date ?? null,
      flooring_installation_date: l.flooring_installation_date ?? null,
    };
    writeJson(path.join("data", `layout_${i + 1}.json`), out);
  });

  // Structure
  const wallText = getValueByStrong($, "Wall");
  const exteriorCover = getValueByStrong($, "Exterior Cover");
  const roofCover = getValueByStrong($, "Roof Cover");
  const maxStories = getValueByStrong($, "Max Stories");
  const finishedArea =
    getValueByStrong($, "Total Finished Area") ||
    getValueByStrong($, "Finished Area");

  const useCode = useCodeText || "";
  const structureOut = {
    architectural_style_type: null,
    attachment_type: useCode.toLowerCase().includes("attached")
      ? "Attached"
      : null,
    exterior_wall_material_primary:
      wallText && wallText.toLowerCase().includes("concrete block")
        ? "Concrete Block"
        : null,
    exterior_wall_material_secondary:
      exteriorCover && exteriorCover.toLowerCase().includes("stucco")
        ? "Stucco Accent"
        : null,
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
    roof_covering_material: mapRoofCovering(roofCover),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: mapRoofCovering(roofCover) ? "Shingle" : null,
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
    primary_framing_material:
      wallText && wallText.toLowerCase().includes("concrete block")
        ? "Concrete Block"
        : null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    finished_base_area: finishedArea ? cleanNum(finishedArea) : null,
    finished_basement_area: null,
    finished_upper_story_area: 0,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories: maxStories ? parseFloat(maxStories) : null,
    exterior_door_installation_date: null,
    siding_installation_date: null,
    roof_date: null,
    window_installation_date: null,
    foundation_repair_date: null,
  };
  writeJson(path.join("data", "structure.json"), structureOut);
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  try {
    const obj = JSON.parse(e.message);
    console.error(JSON.stringify(obj));
  } catch (_) {
    console.error(e.stack || String(e));
  }
  process.exit(1);
}
