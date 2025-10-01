const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(text) {
  if (!text) return null;
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : null;
}

function toISODate(mdyyyy) {
  if (!mdyyyy) return null;
  // Accept formats like M/D/YYYY or MM/DD/YYYY
  const m = mdyyyy.trim().match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  const month = String(mm).padStart(2, "0");
  const day = String(dd).padStart(2, "0");
  return `${yyyy}-${month}-${day}`;
}

function errorObj(message, pathStr) {
  return { type: "error", message, path: pathStr };
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  // Load inputs
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);
  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners (from JSON only)
  let ownersJson = null;
  try {
    ownersJson = readJSON(path.join("owners", "owner_data.json"));
  } catch (e) {
    // owners may be missing; continue
  }

  // Utilities and Layout JSON inputs
  let utilitiesJson = null;
  try {
    utilitiesJson = readJSON(path.join("owners", "utilities_data.json"));
  } catch {}
  let layoutJson = null;
  try {
    layoutJson = readJSON(path.join("owners", "layout_data.json"));
  } catch {}

  const parcelId = seed.parcel_id || seed.request_identifier;

  // 1) Property (from HTML)
  // Long Legal
  let longLegal = null;
  $("div.w3-container.w3-border.w3-border-blue.w3-cell").each((i, el) => {
    const strong = $(el).find("strong").first().text().trim();
    if (/Long Legal:/i.test(strong)) {
      const text = $(el)
        .text()
        .replace(/\s*Long Legal:\s*/i, "")
        .trim();
      if (text) longLegal = text;
    }
  });
  // Zoning Code and Current Use
  let zoning = null;
  let currentUse = null;
  $("div.w3-row.w3-border.w3-border-blue").each((i, row) => {
    const label = $(row).find("div.w3-cell.w3-half").first().text().trim();
    if (/Zoning Code:/i.test(label)) {
      const val = $(row).find("div.w3-cell.w3-half").last().text().trim();
      zoning = val.replace(/\u00A0/g, "").trim();
      zoning = zoning.split(/\s+/)[0] || null; // e.g., 'AG'
    } else if (/Current Use:/i.test(label)) {
      currentUse = $(row).find("div.w3-cell.w3-half").last().text().trim();
    }
  });

  // property_type mapping from HTML indicators
  let property_type = null;
  if (currentUse) {
    const cu = currentUse.toUpperCase();
    if (/GRAZINGLAND|VACANT|AGRIC/.test(cu)) {
      property_type = "VacantLand";
    } else if (/CONDOMINIUM/.test(cu)) {
      property_type = "Condominium";
    } else if (/SINGLE\s*FAMILY/.test(cu)) {
      property_type = "SingleFamily";
    } else if (/(DUPLEX|TRIPLEX|QUAD|PLEX|MULTI)/.test(cu)) {
      property_type = "MultipleFamily";
    }
  }
  if (!property_type) {
    const salesTable = $('h2:contains("Sales Information")')
      .nextAll("div.w3-responsive")
      .first()
      .find("table");
    const firstDataRow = salesTable.find("tr").eq(1); // skip header row
    const saleCode = firstDataRow.find("td").eq(4).text().trim().toUpperCase();
    const hasBuildingSection =
      $('caption.blockcaption:contains("Building")').length > 0;
    if (/VAC/.test(saleCode) && !hasBuildingSection) {
      property_type = "VacantLand";
    }
  }
  if (!property_type) {
    const err = errorObj(
      "Unable to determine property_type from HTML.",
      "property.property_type",
    );
    writeJSON(path.join(dataDir, "error_property_property_type.json"), err);
  }

  // Validate and normalize property_type against allowed enum; default to VacantLand
  const allowedPropertyTypes = new Set([
    "Cooperative",
    "Condominium",
    "Modular",
    "ManufacturedHousingMultiWide",
    "Pud",
    "Timeshare",
    "2Units",
    "DetachedCondominium",
    "Duplex",
    "SingleFamily",
    "MultipleFamily",
    "3Units",
    "ManufacturedHousing",
    "ManufacturedHousingSingleWide",
    "4Units",
    "Townhouse",
    "NonWarrantableCondo",
    "VacantLand",
    "Retirement",
    "MiscellaneousResidential",
    "ResidentialCommonElementsAreas",
    "MobileHome",
    "Apartment",
    "MultiFamilyMoreThan10",
    "MultiFamilyLessThan10",
  ]);
  if (typeof property_type === "string") {
    property_type = property_type.trim();
  }
  const finalPropertyType =
    property_type && allowedPropertyTypes.has(property_type)
      ? property_type
      : null;

  const property = {
    parcel_identifier: String(parcelId),
    property_legal_description_text: longLegal || null,
    property_type: finalPropertyType,
    property_structure_built_year: null,
    number_of_units_type: null,
    livable_floor_area: null,
    number_of_units: null,
    property_effective_built_year: null,
    zoning: zoning || null,
    subdivision: null,
    total_area: null,
    area_under_air: null,
    historic_designation: false,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // 2) Address (from unnormalized_address + HTML for section/township/range)
  const fullAddress = unaddr.full_address || "";
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null;
  try {
    const partsAll = fullAddress.split(",").map((s) => s.trim());
    const streetPart = partsAll[0] || "";
    const cityPart = partsAll[1] || "";
    const stateZipPart = partsAll[2] || "";

    if (streetPart) {
      const sp = streetPart.split(/\s+/);
      street_number = sp.shift() || null;
      let suffix = null;
      if (sp.length >= 1) {
        const last = sp[sp.length - 1];
        if (
          /^(RD|ROAD|DR|ST|AVE|AV|AVENUE|LN|CT|CIR|BLVD|PKWY|HWY|TRL|TER|WAY|PL|PLZ)$/i.test(
            last,
          )
        ) {
          suffix = last.toUpperCase();
          sp.pop();
        } else if (/^[A-Z]{2,}$/i.test(last)) {
          suffix = last.toUpperCase();
          sp.pop();
        }
      }
      street_name = sp.join(" ").toUpperCase() || null;
      const suffixMap = {
        RD: "Rd",
        ROAD: "Rd",
        DR: "Dr",
        DRIVE: "Dr",
        ST: "St",
        STREET: "St",
        AVE: "Ave",
        AV: "Ave",
        AVENUE: "Ave",
        LN: "Ln",
        LANE: "Ln",
        CT: "Ct",
        COURT: "Ct",
        CIR: "Cir",
        CIRCLE: "Cir",
        BLVD: "Blvd",
        BOULEVARD: "Blvd",
        PKWY: "Pkwy",
        PARKWAY: "Pkwy",
        HWY: "Hwy",
        HIGHWAY: "Hwy",
        TRL: "Trl",
        TRAIL: "Trl",
        TER: "Ter",
        TERRACE: "Ter",
        WAY: "Way",
        PL: "Pl",
        PLZ: "Plz",
      };
      if (suffix) {
        const mapped = suffixMap[suffix] || null;
        street_suffix_type =
          mapped || suffix.charAt(0) + suffix.slice(1).toLowerCase();
        const allowed = new Set([
          "Rds",
          "Blvd",
          "Lk",
          "Pike",
          "Ky",
          "Vw",
          "Curv",
          "Psge",
          "Ldg",
          "Mt",
          "Un",
          "Mdw",
          "Via",
          "Cor",
          "Kys",
          "Vl",
          "Pr",
          "Cv",
          "Isle",
          "Lgt",
          "Hbr",
          "Btm",
          "Hl",
          "Mews",
          "Hls",
          "Pnes",
          "Lgts",
          "Strm",
          "Hwy",
          "Trwy",
          "Skwy",
          "Is",
          "Est",
          "Vws",
          "Ave",
          "Exts",
          "Cvs",
          "Row",
          "Rte",
          "Fall",
          "Gtwy",
          "Wls",
          "Clb",
          "Frk",
          "Cpe",
          "Fwy",
          "Knls",
          "Rdg",
          "Jct",
          "Rst",
          "Spgs",
          "Cir",
          "Crst",
          "Expy",
          "Smt",
          "Trfy",
          "Cors",
          "Land",
          "Uns",
          "Jcts",
          "Ways",
          "Trl",
          "Way",
          "Trlr",
          "Aly",
          "Spg",
          "Pkwy",
          "Cmn",
          "Dr",
          "Grns",
          "Oval",
          "Cirs",
          "Pt",
          "Shls",
          "Vly",
          "Hts",
          "Clf",
          "Flt",
          "Mall",
          "Frds",
          "Cyn",
          "Lndg",
          "Mdws",
          "Rd",
          "Xrds",
          "Ter",
          "Prt",
          "Radl",
          "Grvs",
          "Rdgs",
          "Inlt",
          "Trak",
          "Byu",
          "Vlgs",
          "Ctr",
          "Ml",
          "Cts",
          "Arc",
          "Bnd",
          "Riv",
          "Flds",
          "Mtwy",
          "Msn",
          "Shrs",
          "Rue",
          "Crse",
          "Cres",
          "Anx",
          "Drs",
          "Sts",
          "Holw",
          "Vlg",
          "Prts",
          "Sta",
          "Fld",
          "Xrd",
          "Wall",
          "Tpke",
          "Ft",
          "Bg",
          "Knl",
          "Plz",
          "St",
          "Cswy",
          "Bgs",
          "Rnch",
          "Frks",
          "Ln",
          "Mtn",
          "Ctrs",
          "Orch",
          "Iss",
          "Brks",
          "Br",
          "Fls",
          "Trce",
          "Park",
          "Gdns",
          "Rpds",
          "Shl",
          "Lf",
          "Rpd",
          "Lcks",
          "Gln",
          "Pl",
          "Path",
          "Vis",
          "Lks",
          "Run",
          "Frg",
          "Brg",
          "Sqs",
          "Xing",
          "Pln",
          "Glns",
          "Blfs",
          "Plns",
          "Dl",
          "Clfs",
          "Ext",
          "Pass",
          "Gdn",
          "Brk",
          "Grn",
          "Mnr",
          "Cp",
          "Pne",
          "Spur",
          "Opas",
          "Upas",
          "Tunl",
          "Sq",
          "Lck",
          "Ests",
          "Shr",
          "Dm",
          "Mls",
          "Wl",
          "Mnrs",
          "Stra",
          "Frgs",
          "Frst",
          "Flts",
          "Ct",
          "Mtns",
          "Frd",
          "Nck",
          "Ramp",
          "Vlys",
          "Pts",
          "Bch",
          "Loop",
          "Byp",
          "Cmns",
          "Fry",
          "Walk",
          "Hbrs",
          "Dv",
          "Hvn",
          "Blf",
          "Grv",
          "Crk",
          null,
        ]);
        if (street_suffix_type && !allowed.has(street_suffix_type)) {
          const err = errorObj(
            `Unknown enum value ${street_suffix_type}.`,
            "address.street_suffix_type",
          );
          writeJSON(
            path.join(dataDir, "error_address_street_suffix_type.json"),
            err,
          );
          street_suffix_type = null;
        }
      }
    }
    if (cityPart) city_name = cityPart.toUpperCase();
    if (stateZipPart) {
      const stZip = stateZipPart.split(/\s+/).filter(Boolean);
      state_code = stZip[0] || null;
      postal_code = stZip[1] || null;
    }
  } catch {}

  // Section/Township/Range from HTML
  let section = null,
    township = null,
    range = null;
  $("div.w3-row.w3-border.w3-border-blue").each((i, row) => {
    const label = $(row).find("div.w3-cell.w3-half").first().text().trim();
    if (/Section\/Township\/Range:/i.test(label)) {
      const val = $(row).find("div.w3-cell.w3-half").last().text().trim();
      const m = val.match(/(\d+)\-(\d+)\-(\d+)/);
      if (m) {
        section = m[1];
        township = m[2];
        range = m[3];
      }
    }
  });

  const address = {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: null,
    country_code: null,
    county_name: "Charlotte",
    latitude: null,
    longitude: null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    lot: null,
    block: null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // 3) Taxes (Preliminary 2025 from HTML)
  let taxYear = null;
  let justValue = null;
  let assessedValue = null;
  let taxableValue = null;
  $("table.prctable caption.blockcaption").each((i, el) => {
    const cap = $(el).text();
    if (/Preliminary Tax Roll Values/i.test(cap)) {
      const m = cap.match(/(\d{4})\s*Preliminary Tax Roll Values/i);
      if (m) taxYear = parseInt(m[1], 10);
      const table = $(el).parent();
      const rows = table.find("tr");
      rows.each((ri, row) => {
        const cells = $(row).find("td");
        if (cells.length === 0) return;
        const label = $(cells[0]).text().trim();
        if (/Preliminary Just Value/i.test(label)) {
          justValue = parseCurrencyToNumber($(cells[1]).text());
        } else if (/Preliminary Assessed Value/i.test(label)) {
          assessedValue = parseCurrencyToNumber($(cells[1]).text());
        } else if (/Preliminary Taxable Value/i.test(label)) {
          taxableValue = parseCurrencyToNumber($(cells[1]).text());
        }
      });
    }
  });
  if (taxYear) {
    const taxObj = {
      tax_year: taxYear,
      property_assessed_value_amount:
        assessedValue != null ? assessedValue : null,
      property_market_value_amount: justValue != null ? justValue : null,
      property_building_amount: null,
      property_land_amount: null,
      property_taxable_value_amount: taxableValue != null ? taxableValue : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(dataDir, `tax_${taxYear}.json`), taxObj);
  }

  // 4) Sales (from Sales Information table) with instrument and links for deeds/files
  const sales = [];
  $('h2:contains("Sales Information")').each((i, h2) => {
    const table = $(h2).nextAll("div.w3-responsive").first().find("table");
    table.find("tr").each((ri, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 6) {
        const date = $(cells[0]).text().trim();
        const bookPageCell = $(cells[1]);
        const instrCell = $(cells[2]);
        const priceText = $(cells[3]).text().trim();
        const iso = toISODate(date);
        const price = parseCurrencyToNumber(priceText);
        let bookPage = bookPageCell.text().trim();
        let bookPageHref = bookPageCell.find("a").attr("href") || null;
        let instrument = instrCell.text().trim();
        let instrumentHref = instrCell.find("a").attr("href") || null;
        // Normalize empty strings to null
        if (bookPage === "") bookPage = null;
        if (instrument === "") instrument = null;
        if (iso && price != null && price > 0) {
          sales.push({
            ownership_transfer_date: iso,
            purchase_price_amount: price,
            instrument,
            instrumentHref,
            bookPage,
            bookPageHref,
          });
        }
      }
    });
  });
  // Sort by date desc, newest first
  sales.sort((a, b) =>
    a.ownership_transfer_date < b.ownership_transfer_date ? 1 : -1,
  );
  sales.forEach((s, idx) => {
    writeJSON(path.join(dataDir, `sales_${idx + 1}.json`), {
      ownership_transfer_date: s.ownership_transfer_date,
      purchase_price_amount: s.purchase_price_amount,
    });
  });

  // 5) Owners (company/person) from owners/owner_data.json only
  const ownerKey = `property_${parcelId}`;
  const currentOwners =
    ownersJson &&
    ownersJson[ownerKey] &&
    ownersJson[ownerKey].owners_by_date &&
    ownersJson[ownerKey].owners_by_date.current
      ? ownersJson[ownerKey].owners_by_date.current
      : [];

  let personCount = 0,
    companyCount = 0;
  const ownerFiles = [];
  for (const owner of currentOwners) {
    if (owner.type === "company") {
      companyCount += 1;
      const f = `company_${companyCount}.json`;
      writeJSON(path.join(dataDir, f), { name: owner.name || null });
      ownerFiles.push({ type: "company", file: f });
    } else if (owner.type === "person") {
      // Person schema requires many fields we do not have in owner_data; do not fabricate
      continue;
    }
  }

  // 6) Relationships sales -> owners for ALL sales
  if (sales.length > 0 && ownerFiles.length > 0) {
    sales.forEach((s, sIdx) => {
      const saleFile = `./sales_${sIdx + 1}.json`;
      ownerFiles.forEach((of, oIdx) => {
        const rel = { to: { "/": `./${of.file}` }, from: { "/": saleFile } };
        const base =
          of.type === "company"
            ? "relationship_sales_company"
            : "relationship_sales_person";
        const name =
          sIdx === 0 && oIdx === 0
            ? `${base}.json`
            : `${base}_${sIdx + 1}_${oIdx + 1}.json`;
        writeJSON(path.join(dataDir, name), rel);
      });
    });
  }

  // 7) Flood (from HTML FEMA Flood Zone table)
  let effectiveDate = null,
    panelNumber = null,
    floodZone = null,
    communityId = null,
    fips = null;
  $('caption.blockcaption:contains("FEMA Flood Zone").blockcaption').each(
    (i, cap) => {
      const table = $(cap).parent();
      const captionText = $(cap).text();
      const m = captionText.match(/Effective\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
      if (m) {
        effectiveDate = toISODate(`${m[1]}/${m[2]}/${m[3]}`);
      }
      const firstRow = table.find("tr").eq(1);
      const cells = firstRow.find("td");
      if (cells.length > 0) {
        panelNumber =
          $(cells[0])
            .text()
            .trim()
            .replace(/\u00A0/g, "") || null; // Firm Panel
        floodZone =
          $(cells[3])
            .text()
            .trim()
            .replace(/\u00A0/g, "") || null; // Flood Zone
        fips =
          $(cells[4])
            .text()
            .trim()
            .replace(/\u00A0/g, "") || null; // FIPS (map_version proxy)
        communityId =
          $(cells[6])
            .text()
            .trim()
            .replace(/\u00A0/g, "") || null; // Community
      }
    },
  );
  if (panelNumber || floodZone || communityId || effectiveDate) {
    const floodObj = {
      community_id: communityId || null,
      panel_number: panelNumber || null,
      map_version: fips || null,
      effective_date: effectiveDate || null,
      evacuation_zone: null,
      flood_zone: floodZone || null,
      flood_insurance_required: floodZone ? !/^X$/i.test(floodZone) : false,
      fema_search_url: null,
    };
    writeJSON(path.join(dataDir, "flood_storm_information.json"), floodObj);
  }

  // 8) Utilities (from owners/utilities_data.json only)
  if (utilitiesJson) {
    const u = utilitiesJson[`property_${parcelId}`];
    if (u) {
      writeJSON(path.join(dataDir, "utility.json"), u);
    }
  }

  // 9) Layouts (from owners/layout_data.json only)
  if (layoutJson) {
    const ly = layoutJson[`property_${parcelId}`];
    if (ly && Array.isArray(ly.layouts)) {
      ly.layouts.forEach((layout, idx) => {
        const requiredFields = [
          "space_type",
          "space_index",
          "flooring_material_type",
          "size_square_feet",
          "floor_level",
          "has_windows",
          "window_design_type",
          "window_material_type",
          "window_treatment_type",
          "is_finished",
          "furnished",
          "paint_condition",
          "flooring_wear",
          "clutter_level",
          "visible_damage",
          "countertop_material",
          "cabinet_style",
          "fixture_finish_quality",
          "design_style",
          "natural_light_quality",
          "decor_elements",
          "pool_type",
          "pool_equipment",
          "spa_type",
          "safety_features",
          "view_type",
          "lighting_features",
          "condition_issues",
          "is_exterior",
          "pool_condition",
          "pool_surface_type",
          "pool_water_quality",
        ];
        const hasAll = requiredFields.every((k) =>
          Object.prototype.hasOwnProperty.call(layout, k),
        );
        if (hasAll) {
          writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), layout);
        }
      });
    }
  }

  // 10) Deeds and Files derived from sales data and links in the table
  // Create deed_i.json (minimal) and file_i.json for each sale, maintain order with sales_i.json
  sales.forEach((s, idx) => {
    const deedIndex = idx + 1;
    const deedPath = path.join(dataDir, `deed_${deedIndex}.json`);
    // deed schema has no required fields, so create an empty deed object
    writeJSON(deedPath, {});

    // File asset if we have any href (instrument preferred; fallback to book/page href)
    const href = s.instrumentHref || s.bookPageHref || null;
    const fileObj = {
      file_format: href ? "txt" : "txt",
      name: `Conveyance Document ${s.instrument || s.bookPage || ""}`.trim(),
      original_url: href || null,
      ipfs_url: null,
      document_type: "ConveyanceDeed",
    };
    const filePath = path.join(dataDir, `file_${deedIndex}.json`);
    writeJSON(filePath, fileObj);

    // relationship_deed_file (file -> deed)
    const relDF = {
      to: { "/": `./deed_${deedIndex}.json` },
      from: { "/": `./file_${deedIndex}.json` },
    };
    const relDFName =
      deedIndex === 1
        ? "relationship_deed_file.json"
        : `relationship_deed_file_${deedIndex}.json`;
    writeJSON(path.join(dataDir, relDFName), relDF);

    // relationship_sales_deed (deed -> sales)
    const relSD = {
      to: { "/": `./sales_${deedIndex}.json` },
      from: { "/": `./deed_${deedIndex}.json` },
    };
    const relSDName =
      deedIndex === 1
        ? "relationship_sales_deed.json"
        : `relationship_sales_deed_${deedIndex}.json`;
    writeJSON(path.join(dataDir, relSDName), relSD);
  });

  // 11) Structure - not available; skip.
}

if (require.main === module) {
  main();
}
