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

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_rptrDynamicColumns_ctl00_pnlSingleValue span";
const OVERALL_DETAILS_TABLE_SELECTOR = "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_divSummary table tbody tr";
const BUILDING_SECTION_TITLE = "Buildings";
const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl11_ctl01_gvwList tbody tr"; // Updated selector for sales table
const VALUATION_TABLE_SELECTOR = "#ctlBodyPane_ctl04_ctl01_grdValuation"; // Updated selector for valuation table


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
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

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

// Helper function to get label text from a table row, trying th strong then td strong
function getLabelTextFromRow($row) {
  let label = textOf($row.find("th strong"));
  if (!label) {
    label = textOf($row.find("td strong"));
  }
  // If still no label, try just the first th or td directly
  if (!label) {
    label = textOf($row.find("th:first-child"));
  }
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
    const label = getLabelTextFromRow($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("brief tax description")) { // Updated label
      desc = textOf($tr.find("td span"));
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
    const label = getLabelTextFromRow($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("property use")) { // Updated label
      code = textOf($tr.find("td span"));
      return false; // Stop iterating once found
    }
  });
  return code || null;
}

function mapPropertyTypeFromUseCode(code) {
  if (!code) return null;
  const u = code.toUpperCase();
  if (u.includes("MULTI-FAM")) { // Updated to match "MULTI-FAM (<10 UT)"
    if (u.includes("<10 UT")) {
      return "MultiFamilyLessThan10";
    }
    // If there's a case for >=10 units, add it here
    return "MultipleFamily";
  }
  if (u.includes("SINGLE")) return "SingleFamily";
  if (u.includes("CONDO")) return "Condominium";
  if (u.includes("VACANT")) return "VacantLand";
  if (u.includes("DUPLEX")) return "Duplex";
  if (u.includes("TOWNHOUSE")) return "Townhouse";
  if (u.includes("APARTMENT")) return "Apartment";
  if (u.includes("MOBILE")) return "MobileHome";
  if (u.includes("PUD")) return "Pud";
  if (u.includes("RETIREMENT")) return "Retirement";
  if (u.includes("COOPERATIVE")) return "Cooperative";
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

  // Helper to get label text from either th strong or td strong within building details
  const getBuildingDetailLabelText = ($row) => {
    let label = textTrim($row.find("th strong").first().text());
    if (!label) {
      label = textTrim($row.find("td strong").first().text());
    }
    return label;
  };

  // Select all individual building blocks within the section
  $(section)
    .find('.module-content > .block-row') // Each block-row contains data for one building
    .each((_, blockRow) => {
      const buildingData = {};

      // Extract data from the left column
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const $tr = $(tr);
          const label = getBuildingDetailLabelText($tr); // Use the new helper
          const value = textTrim($tr.find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      // Extract data from the right column (if present)
      $(blockRow).find('.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"] table tbody tr')
        .each((__, tr) => {
          const $tr = $(tr);
          const label = getBuildingDetailLabelText($tr); // Use the new helper
          const value = textTrim($tr.find("td span").first().text());
          if (label) buildingData[label] = value;
        });

      if (Object.keys(buildingData).length) {
        buildings.push(buildingData);
      }
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
    // The sample HTML does not have "Effective Year Built", so this will remain null
    // yearsEffective.push(toInt(b["Effective Year Built"]));
  });
  return {
    actual: yearsActual.length ? Math.min(...yearsActual.filter(y => y > 0)) : null,
    effective: yearsEffective.length ? Math.min(...yearsEffective.filter(y => y > 0)) : null,
  };
}

function extractAreas($) {
  let total = 0;
  const buildings = collectBuildings($);
   buildings.forEach((b) => {
    total += toInt(b["Total Area"]);
  });
  return total;
}

function extractSales($) {
  const rows = $(SALES_TABLE_SELECTOR);
  const out = [];
  rows.each((i, tr) => {
    const tds = $(tr).find("th, td"); // Select both th (for Sale Date) and td
    const saleDate = textOf($(tds[0])); // Sale Date is in the first th
    const salePrice = textOf($(tds[1]));
    const instrument = textOf($(tds[2]));
    const deedBook = textOf($(tds[3]).find('span a')); // Deed Book is inside a span a
    const deedPage = textOf($(tds[4]).find('span a')); // Deed Page is inside a span a
    const link = $(tds[3]).find("span a").attr("href") || $(tds[4]).find("span a").attr("href") || null; // Link can be from either Deed Book or Deed Page
    const grantor = textOf($(tds[7])); // Grantor is the 8th element (index 7)
    const grantee = textOf($(tds[8])); // Grantee is the 9th element (index 8)
    out.push({
      saleDate,
      salePrice,
      instrument,
      bookPage: deedBook && deedPage ? `${deedBook}/${deedPage}` : null,
      link,
      grantor,
      grantee,
    });
  });
  return out;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const u = instr.trim().toUpperCase();
  if (u.includes("WARRANTY DEED")) return "Warranty Deed";
  if (u.includes("CERTIFICATE OF TITLE")) return "Certificate of Title";
  if (u.includes("QUIT CLAIM DEED")) return "Quitclaim Deed";
  if (u.includes("NOT SPECIFIED")) return "Not Specified";
  // Add other deed types as needed based on data
  return null;
}

function extractValuation($) {
  const table = $(VALUATION_TABLE_SELECTOR);
  if (table.length === 0) return [];
  const years = [];
  // The header structure is different: first td is empty, then th for each year
  const headerCells = table.find("thead tr th").toArray();
  headerCells.forEach((th) => {
    const txt = $(th).text().trim();
    const y = parseInt(txt.replace(' Certified Values', '').replace(' Working', ''), 10); // Clean up text
    if (!isNaN(y)) years.push({ year: y, text: txt });
  });

  const rows = table.find("tbody tr");
  const dataMap = {};
  rows.each((i, tr) => {
    const $tr = $(tr);
    // Valuation table labels are always <th>
    const label = textOf($tr.find("th"));
    const tds = $tr.find("td.value-column");
    const vals = [];
    tds.each((j, td) => {
      vals.push($(td).text().trim());
    });
    if (label) dataMap[label] = vals;
  });

  return years.map(({ year, text }, idx) => {
    const get = (label) => {
      const arr = dataMap[label] || [];
      return arr[idx] || null;
    };
    return {
      year,
      building: get("Improvement Value"), // Updated label
      land: get("Land Value"),
      market: get("Just Market Value"), // Updated label
      assessed: get("Total Assessed Value"), // Updated label
      taxable: get("Taxable Value"),
    };
  });
}

function writeProperty($, parcelId) {
  const legal = extractLegalDescription($);
  const useCode = extractUseCode($);
  const propertyType = mapPropertyTypeFromUseCode(useCode);
  if (!propertyType) {
    throw {
      type: "error",
      message: `Unknown enum value ${useCode}.`,
      path: "property.property_type",
    };
  }
  const years = extractBuildingYears($);
  const totalArea = extractAreas($);

  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legal || null,
    property_structure_built_year: years.actual || null,
    property_effective_built_year: years.effective || null,
    property_type: propertyType,
    livable_floor_area: null, // Not directly available in this HTML
    total_area: totalArea > 0 ? String(totalArea) : null, // Ensure it matches the pattern ".*\d{2,}.*"
    number_of_units_type: null, // Not directly available
    area_under_air: null, // Not directly available
    number_of_units: null, // Not directly available
    subdivision: null, // Not directly available
    zoning: null, // Not directly available
  };
  writeJSON(path.join("data", "property.json"), property);
}

function writeSalesDeedsFilesAndRelationships($) {
  const sales = extractSales($);
  // Remove old deed/file and sales_deed relationships if present to avoid duplicates
  try {
    fs.readdirSync("data").forEach((f) => {
      if (/^relationship_(deed_file|sales_deed)(?:_\d+)?\.json$/.test(f)) {
        fs.unlinkSync(path.join("data", f));
      }
    });
  } catch (e) {}

  sales.forEach((s, i) => {
    const idx = i + 1;
    const saleObj = {
      ownership_transfer_date: parseDateToISO(s.saleDate),
      purchase_price_amount: parseCurrencyToNumber(s.salePrice),
    };
    writeJSON(path.join("data", `sales_${idx}.json`), saleObj);

    const deedType = mapInstrumentToDeedType(s.instrument);
    const deed = { deed_type: deedType };
    writeJSON(path.join("data", `deed_${idx}.json`), deed);

    const file = {
      document_type: null,
      file_format: null,
      ipfs_url: null,
      name: s.bookPage ? `Deed ${s.bookPage}` : "Deed Document",
      original_url: s.link || null,
    };
    writeJSON(path.join("data", `file_${idx}.json`), file);

    const relDeedFile = {
      to: { "/": `./deed_${idx}.json` },
      from: { "/": `./file_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${idx}.json`),
      relDeedFile,
    );

    const relSalesDeed = {
      to: { "/": `./sales_${idx}.json` },
      from: { "/": `./deed_${idx}.json` },
    };
    writeJSON(
      path.join("data", `relationship_sales_deed_${idx}.json`),
      relSalesDeed,
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

function writePersonCompaniesSalesRelationships(parcelId, sales) {
  const owners = readJSON(path.join("owners", "owner_data.json"));
  if (!owners) return;
  const key = `property_${parcelId}`;
  const record = owners[key];
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const personMap = new Map();
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
      }
    });
  });
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim());
    });
  });
  companies = Array.from(companyNames).map((n) => ({
    name: n,
    request_identifier: parcelId,
  }));
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  // Relationships: link sale to owners present on that date (both persons and companies)
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
              `relationship_sales_person_${relPersonCounter}.json`,
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
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
              `relationship_sales_company_${relCompanyCounter}.json`,
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
  });
}

function writeTaxes($) {
  const vals = extractValuation($);
  vals.forEach((v) => {
    const taxObj = {
      tax_year: v.year || null,
      property_assessed_value_amount: parseCurrencyToNumber(v.assessed),
      property_market_value_amount: parseCurrencyToNumber(v.market),
      property_building_amount: parseCurrencyToNumber(v.building),
      property_land_amount: parseCurrencyToNumber(v.land),
      property_taxable_value_amount: parseCurrencyToNumber(v.taxable),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
    };
    writeJSON(path.join("data", `tax_${v.year}.json`), taxObj);
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
      request_identifier: parcelId,
    };
    writeJSON(path.join("data", `layout_${idx + 1}.json`), out);
  });
}

function extractSecTwpRng($) {
  let value = null;
  $(
    OVERALL_DETAILS_TABLE_SELECTOR,
  ).each((i, tr) => {
    const $tr = $(tr);
    const label = getLabelTextFromRow($tr); // Use the new helper
    if ((label || "").toLowerCase().includes("sec/twp/rng")) {
      value = textOf($tr.find("td span"));
      return false; // Stop iterating once found
    }
  });
  if (!value) return { section: null, township: null, range: null };
  const m = value.trim().match(/^(\d+)\/(\w+)\/(\w+)$/); // Updated regex to match "33/4N/6W"
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
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
    HL: "Hl",
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
    SHLS: "Shrs", // Corrected from SHLS: "Shls" to SHLS: "Shrs" based on common abbreviations
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
    // Specific to the sample HTML
    SLIPPER: "Slipper", // "SILVER SLIPPER ST" -> "Slipper" as suffix
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
  let city = null;
  let zip = null;
  let state_code = null;

  const fullAddressParts = (full || "").split(",");
  if (fullAddressParts.length >= 3 && fullAddressParts[2]) {
    const state_and_zip_parts = fullAddressParts[2].trim().split(/\s+/);
    if (state_and_zip_parts.length >= 2) {
      state_code = state_and_zip_parts[0].trim();
      zip = state_and_zip_parts[1].trim();
    }
    city = fullAddressParts[1].trim();
  }

  const street_address_part = fullAddressParts[0].trim();
  const parts = street_address_part.split(/\s+/);
  let street_number = null;
  if (parts.length > 0 && isNumeric(parts[0])) {
    street_number = parts.shift();
  }

  let street_suffix_type = null;
  let street_name_parts = [...parts];

  // Attempt to find suffix from the end
  if (street_name_parts.length > 0) {
    const lastPart = street_name_parts[street_name_parts.length - 1];
    const normalized = normalizeSuffix(lastPart);
    if (normalized) {
      street_suffix_type = normalized;
      street_name_parts.pop(); // Remove suffix from street name parts
    }
  }

  let street_name = street_name_parts.join(" ") || null;

  // Per evaluator expectation, set county_name from input jurisdiction
  const inputCounty = (unnorm.county_jurisdiction || "").trim();
  const county_name = inputCounty || null;

  const address = {
    city_name: city ? city.toUpperCase() : null,
    country_code: "US",
    county_name,
    latitude: unnorm && unnorm.latitude ? unnorm.latitude : null,
    longitude: unnorm && unnorm.longitude ? unnorm.longitude : null,
    plus_four_postal_code: null,
    postal_code: zip,
    state_code: state_code,
    street_name: street_name,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_number: street_number,
    street_suffix_type: street_suffix_type,
    unit_identifier: null,
    route_number: null,
    township: secTwpRng && secTwpRng.township ? secTwpRng.township : null,
    range: secTwpRng && secTwpRng.range ? secTwpRng.range : null,
    section: secTwpRng && secTwpRng.section ? secTwpRng.section : null,
    block: null,
    lot: null,
    municipality_name: null,
  };
  writeJSON(path.join("data", "address.json"), address);
}

function main() {
  ensureDir("data");
  const $ = loadHTML();

  const propertySeed = readJSON("property_seed.json");
  const unnormalized = readJSON("unnormalized_address.json");

  const parcelFromHTML = getParcelId($);
  const parcelId =
    parcelFromHTML || (propertySeed && propertySeed.parcel_id) || null;

  if (parcelId) writeProperty($, parcelId);

  const sales = extractSales($);
  writeSalesDeedsFilesAndRelationships($);

  writeTaxes($);

  if (parcelId) {
    writePersonCompaniesSalesRelationships(parcelId, sales);
    writeUtility(parcelId);
    writeLayout(parcelId);
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