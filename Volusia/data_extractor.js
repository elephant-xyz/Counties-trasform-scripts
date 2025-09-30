const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}
function parseMoney(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const num = Number(s);
  return isNaN(num)
    ? null
    : Number(Number.isInteger(num) ? num : +num.toFixed(2));
}
function getNextTextAfterStrong($, label) {
  let val = null;
  $("strong").each((i, el) => {
    const t = $(el).text().trim();
    if (val == null && t === label) {
      const row = $(el).closest(".row");
      if (row.length) {
        const labelCol = $(el).closest("div");
        const next = labelCol.next();
        if (next && next.length) {
          val = next.text().trim().replace(/\s+/g, " ");
        }
      }
    }
  });
  return val;
}
function sanitizeHttpUrl(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

function toISODate(mmddyyyy) {
  if (!mmddyyyy) return null;
  const m = mmddyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function extractLegalDescription($) {
  // Find the strong label, then take parent text minus the label
  const strong = $("strong")
    .filter((i, el) => $(el).text().trim() === "Legal Description")
    .first();
  if (strong.length) {
    const parent = strong.parent();
    if (parent && parent.length) {
      const clone = parent.clone();
      clone.find("strong").remove();
      const txt = clone
        .text()
        .trim()
        .replace(/^\s*[:\-]?\s*/, "")
        .replace(/\s+/g, " ");
      return txt || null;
    }
  }
  return null;
}

function extractPropertyValuesByYear($, year) {
  // Search within section-values for blocks containing the year
  const result = { building: null, land: null, market: null };
  $("#section-values")
    .find("*")
    .each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes(String(year))) {
        // Try labeled (mobile) pattern
        const m1 = text.match(/Improvement Value:\s*\$([0-9,]+)/i);
        const m2 = text.match(/Land Value:\s*\$([0-9,]+)/i);
        const m3 = text.match(/Just\/Market Value:\s*\$([0-9,]+)/i);
        if (m1 && m2 && m3) {
          result.building = `$${m1[1]}`;
          result.land = `$${m2[1]}`;
          result.market = `$${m3[1]}`;
          return false;
        }
        // Try unlabeled column pattern: pick first three $ amounts
        const dollars = text.match(/\$[0-9,]+/g);
        if (dollars && dollars.length >= 3) {
          // In Property Values, order is Improvement, Land, Just
          result.building = dollars[0];
          result.land = dollars[1];
          result.market = dollars[2];
          return false;
        }
      }
    });
  return result;
}

function extractWorkingTaxValues($) {
  // From Working Tax Roll Values by Taxing Authority (first ad valorem row)
  const r = { market: null, assessed: null, taxable: null };
  const rows = $("#taxAuthority .row");
  for (let i = 0; i < rows.length; i++) {
    const row = rows.eq(i);
    const text = row.text();
    const dollars = text.match(/\$[0-9,]+/g);
    if (dollars && dollars.length >= 4) {
      r.market = dollars[0];
      r.assessed = dollars[1];
      // dollars[2] is Ex/10CAP
      r.taxable = dollars[3];
      break;
    }
  }
  return r;
}

function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const html = readText("input.html");
  const $ = cheerio.load(html);

  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Owners, Utilities, Layout from owners/*.json
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownersData = readJSON(ownersPath);
  const utilsData = readJSON(utilsPath);
  const layoutData = readJSON(layoutPath);

  // Helper extractors from HTML
  function extractTopValue(label) {
    let out = null;
    $(".row").each((i, row) => {
      const $row = $(row);
      const strongs = $row.find("strong");
      strongs.each((j, s) => {
        if ($(s).text().trim() === label) {
          const parentCol = $(s).closest("div");
          const vcol = parentCol.next();
          if (vcol && vcol.length) {
            out = vcol.text().trim().replace(/\s+/g, " ");
          }
        }
      });
    });
    return out;
  }

  const parcelId = (
    extractTopValue("Parcel ID:") ||
    seed.parcel_id ||
    ""
  ).replace(/[^0-9]/g, "");

  // Address components: prefer unnormalized_address.full_address
  const fullAddr = unAddr.full_address || extractTopValue("Physical Address:");
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null,
    street_pre_directional_text = null,
    street_post_directional_text = null;

  function parseStreetBodyForComponents(streetBody) {
    if (!streetBody) return { streetName: null, suffix: null, preDir: null, postDir: null };
    const DIRS = new Set(["E", "N", "NE", "NW", "S", "SE", "SW", "W"]);
    const suffixMap = {
      DR: "Dr",
      "DR.": "Dr",
      DRIVE: "Dr",
      "DRIVE.": "Dr",
      RD: "Rd",
      ROAD: "Rd",
      AVE: "Ave",
      AV: "Ave",
      AVENUE: "Ave",
      ST: "St",
      "ST.": "St",
      LN: "Ln",
      LANE: "Ln",
      BLVD: "Blvd",
      CT: "Ct",
      COURT: "Ct",
      HWY: "Hwy",
      PKWY: "Pkwy",
      PL: "Pl",
      TER: "Ter",
      TRL: "Trl",
      WAY: "Way",
      CIR: "Cir",
      PLZ: "Plz",
      SQ: "Sq",
      XING: "Xing",
      LOOP: "Loop",
      RUN: "Run",
      "RD.": "Rd",
      "AVE.": "Ave",
      "HWY.": "Hwy",
      "BLVD.": "Blvd",
    };
    const allowedSuffix = new Set([
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

    const tokens = streetBody
      .replace(/\./g, "")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return { streetName: null, suffix: null, preDir: null, postDir: null };
    }

    let preDir = null;
    let postDir = null;
    let suffix = null;

    // Pre-directional (first token)
    const firstTok = tokens[0].toUpperCase();
    if (DIRS.has(firstTok)) {
      preDir = firstTok;
      tokens.shift();
    }

    // Suffix (last token that matches a suffix)
    if (tokens.length > 0) {
      const lastTok = tokens[tokens.length - 1].toUpperCase();
      const mappedSuffix =
        suffixMap[lastTok] ||
        (lastTok ? lastTok[0] + lastTok.slice(1).toLowerCase() : null);
      if (mappedSuffix && allowedSuffix.has(mappedSuffix)) {
        suffix = mappedSuffix;
        tokens.pop();
      }
    }

    // Post-directional (if any remaining last token is a direction)
    if (tokens.length > 0) {
      const lastTok2 = tokens[tokens.length - 1].toUpperCase();
      if (DIRS.has(lastTok2)) {
        postDir = lastTok2;
        tokens.pop();
      }
    }

    const streetName = tokens.join(" ").trim() || null;
    return { streetName, suffix, preDir, postDir };
  }

  if (fullAddr) {
    const m = fullAddr.match(
      /^(\d+)\s+(.+?)\s*,\s*([A-Z\s\-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
    );
    if (m) {
      street_number = m[1];
      const streetBody = m[2].trim();
      const parsed = parseStreetBodyForComponents(streetBody);
      street_suffix_type = parsed.suffix || null;
      street_name = parsed.streetName || null;
      street_pre_directional_text = parsed.preDir || null;
      street_post_directional_text = parsed.postDir || null;
      city_name = m[3].trim();
      state_code = m[4];
      postal_code = m[5];
      plus4 = m[6] || null;
    } else {
      // Fallback minimal parsing
      const segs = fullAddr.split(",").map((s) => s.trim());
      const streetPart = segs[0] || "";
      const cityPart = segs[1] || "";
      const stateZip = segs[2] || "";
      if (streetPart) {
        const p = streetPart.split(/\s+/);
        street_number = p.shift();
        const streetBody = p.join(" ");
        const parsed = parseStreetBodyForComponents(streetBody);
        street_suffix_type = parsed.suffix || null;
        street_name = parsed.streetName || null;
        street_pre_directional_text = parsed.preDir || null;
        street_post_directional_text = parsed.postDir || null;
      }
      city_name = cityPart || null;
      const m2 = stateZip.match(/^([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/);
      if (m2) {
        state_code = m2[1];
        postal_code = m2[2];
        plus4 = m2[3] || null;
      }
    }
  }

  // Lat/Long
  const lat = parseFloat($("#xcoord").attr("value")) || null; // latitude
  const lon = parseFloat($("#ycoord").attr("value")) || null; // longitude

  // Township/Range/Section & Block/Lot
  function parseTRS() {
    let trs =
      extractTopValue("Township-Range-Section:") ||
      getNextTextAfterStrong($, "Township-Range-Section:");
    if (trs) {
      const m = trs.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
      if (m) return { township: m[1], range: m[2], section: m[3] };
    }
    // fallback from Property Description panel
    let content = null;
    $("div").each((i, el) => {
      const txt = $(el).text();
      if (/Township-Range-Section/.test(txt)) {
        const m = txt.match(
          /Township-Range-Section\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/,
        );
        if (m) content = { township: m[1], range: m[2], section: m[3] };
      }
    });
    return content || { township: null, range: null, section: null };
  }
  const trs = parseTRS();

  function parseSBL() {
    const sbl = extractTopValue("Subdivision-Block-Lot:");
    if (sbl) {
      const parts = sbl.split("-").map((s) => s.trim());
      if (parts.length === 3) {
        return { subDiv: parts[0], block: parts[1], lot: parts[2] };
      }
    }
    return { subDiv: null, block: null, lot: null };
  }
  const sbl = parseSBL();

  // Subdivision name
  const subdivisionName = extractTopValue("Subdivision Name:") || null;

  // Year Built and areas
  function toInt(val) {
    if (!val) return null;
    const n = parseInt(String(val).replace(/[^0-9]/g, ""));
    return isNaN(n) ? null : n;
  }
  const yearBuilt =
    toInt(getNextTextAfterStrong($, "Year Built:")) ||
    toInt(html.match(/Year Built:\s*([0-9]{4})/)?.[1]);
  // SFLA
  const sflaTxt = getNextTextAfterStrong($, "Total SFLA:");
  const sfla = sflaTxt ? sflaTxt.replace(/,/g, "").match(/\d+/)?.[0] : null;
  // Total Building Area
  let totalArea = null;
  $("div").each((i, el) => {
    const t = $(el).text();
    if (/Total Building Area/.test(t)) {
      const m = t.match(/Total Building Area\s*([0-9,]+)/);
      if (m) {
        totalArea = m[1].replace(/,/g, "");
        return false;
      }
    }
  });

  // Legal Description
  const legalDesc = extractLegalDescription($);

  // Property Use mapping -> property_type
  const propUse = extractTopValue("Property Use:");
  function mapPropertyTypeFromUse(use) {
    if (!use) return null;
    const u = use.toUpperCase();
    if (u.includes("0100") || u.includes("SINGLE FAMILY"))
      return "SingleFamily";
    if (u.includes("0200")) return "MobileHome";
    if (u.includes("0400")) return "Condominium";
    return null;
  }
  const property_type = mapPropertyTypeFromUse(propUse);
  if (property_type == null) {
    const err = {
      type: "error",
      message: `Unknown enum value ${propUse}.`,
      path: "property.property_type",
    };
    throw new Error(JSON.stringify(err));
  }

  // Build property.json
  const property = {
    area_under_air: sfla ? `${sfla} SF` : null,
    livable_floor_area: sfla ? `${sfla} SF` : null,
    number_of_units: 1,
    number_of_units_type: "One",
    parcel_identifier: parcelId,
    property_effective_built_year: null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: yearBuilt || null,
    property_type: property_type,
    subdivision: subdivisionName || null,
    total_area: totalArea ? `${totalArea} SF` : null,
    zoning: null,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Address.json
  const address = {
    block: sbl.block || null,
    city_name: city_name ? city_name.toUpperCase() : null,
    country_code: "US",
    county_name: "Volusia",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    lot: sbl.lot || null,
    municipality_name: null,
    plus_four_postal_code: plus4 || null,
    postal_code: postal_code || null,
    range: trs.range || null,
    route_number: null,
    section: trs.section || null,
    state_code: state_code || "FL",
    street_name: street_name || null,
    street_number: street_number || null,
    street_post_directional_text: street_post_directional_text || null,
    street_pre_directional_text: street_pre_directional_text || null,
    street_suffix_type: street_suffix_type || null,
    township: trs.township || null,
    unit_identifier: null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // Tax: build for 2025 (Working), 2024 (Final), 2023 (Final)
  function extractPrevYearsRow(year) {
    let found = null;
    $("#previousYears .row").each((i, row) => {
      const cols = $(row).children();
      if (cols.length >= 8) {
        const y = cols.eq(0).text().trim();
        if (y === String(year)) {
          found = {
            land: cols.eq(1).text().trim(),
            impr: cols.eq(2).text().trim(),
            just: cols.eq(3).text().trim(),
            nonSchAssd: cols.eq(4).text().trim(),
            countyExempt: cols.eq(5).text().trim(),
            countyTaxable: cols.eq(6).text().trim(),
          };
        }
      }
    });
    if (!found) {
      $("#previousYears_mobile .row").each((i, row) => {
        const t = $(row).text();
        if (new RegExp(`\\b${year}\\b`).test(t)) {
          const m = t.match(/Land Value:\s*\$([0-9,]+)/);
          const mi = t.match(/Impr Value:\s*\$([0-9,]+)/);
          const mj = t.match(/Just Value:\s*\$([0-9,]+)/);
          const msa = t.match(/Non-Sch Assd:\s*\$([0-9,]+)/);
          const mct = t.match(/County Taxable:\s*\$([0-9,]+)/);
          if (m && mi && mj && msa && mct) {
            found = {
              land: `$${m[1]}`,
              impr: `$${mi[1]}`,
              just: `$${mj[1]}`,
              nonSchAssd: `$${msa[1]}`,
              countyTaxable: `$${mct[1]}`,
            };
          }
        }
      });
    }
    return found;
  }

  function writeTax(year, vals) {
    const taxObj = {
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      property_assessed_value_amount: parseMoney(vals.assessed),
      property_building_amount: parseMoney(vals.impr),
      property_land_amount: parseMoney(vals.land),
      property_market_value_amount: parseMoney(vals.market),
      property_taxable_value_amount: parseMoney(vals.taxable),
      tax_year: year,
      yearly_tax_amount: null,
    };
    writeJSON(path.join(dataDir, `tax_${year}.json`), taxObj);
  }

  // 2024
  const prev2024 = extractPrevYearsRow(2024);
  if (prev2024) {
    writeTax(2024, {
      assessed: prev2024.nonSchAssd,
      impr: prev2024.impr,
      land: prev2024.land,
      market: prev2024.just,
      taxable: prev2024.countyTaxable,
    });
  }

  // 2023
  const prev2023 = extractPrevYearsRow(2023);
  if (prev2023) {
    writeTax(2023, {
      assessed: prev2023.nonSchAssd,
      impr: prev2023.impr,
      land: prev2023.land,
      market: prev2023.just,
      taxable: prev2023.countyTaxable,
    });
  }

  // 2025 Working: combine Property Values (building/land/market) with Working Tax Roll values (assessed/taxable)
  const pv2025 = extractPropertyValuesByYear($, 2025);
  const wtv = extractWorkingTaxValues($);
  if (pv2025 && pv2025.market) {
    writeTax(2025, {
      assessed: wtv.assessed || pv2025.market,
      impr: pv2025.building,
      land: pv2025.land,
      market: pv2025.market,
      taxable: wtv.taxable || pv2025.market,
    });
  }

  // Sales and Deeds and Files
  const salesRows = [];
  $("#section-sales .row").each((i, row) => {
    const $row = $(row);
    if (
      $row.find(".col-sm-2.text-center").length &&
      $row.find(".col-sm-1.text-center").length
    ) {
      const cols = $row.children();
      const bookPage = cols.eq(0).text().trim();
      const instLinkRaw = cols.eq(1).find("a").attr("href") || null;
      const instLink = instLinkRaw ? instLinkRaw.trim() : null;
      const saleDate = cols.eq(2).text().trim();
      const deedType = cols.eq(3).text().trim();
      const priceTxt = cols.eq(6).text().trim();
      if (/\d{2}\/\d{2}\/\d{4}/.test(saleDate)) {
        salesRows.push({ bookPage, instLink, saleDate, deedType, priceTxt });
      }
    }
  });

  function mapDeedType(raw) {
    if (!raw) return null;
    const r = raw.toUpperCase();
    if (r.includes("WARRANTY DEED")) return "Warranty Deed";
    if (r.includes("QUIT")) return "Quitclaim Deed";
    if (r.includes("GRANT DEED")) return "Grant Deed";
    return null;
  }

  salesRows.forEach((row, idx) => {
    const i = idx + 1;
    const sale = {
      ownership_transfer_date: toISODate(row.saleDate),
      purchase_price_amount: parseMoney(row.priceTxt),
    };
    writeJSON(path.join(dataDir, `sales_${i}.json`), sale);

    const deedTypeMapped = mapDeedType(row.deedType);
    if (deedTypeMapped == null && row.deedType) {
      const err = {
        type: "error",
        message: `Unknown enum value ${row.deedType}.`,
        path: "deed.deed_type",
      };
      throw new Error(JSON.stringify(err));
    }
    const deed = {};
    if (deedTypeMapped) deed.deed_type = deedTypeMapped;
    writeJSON(path.join(dataDir, `deed_${i}.json`), deed);

    // File entry from instrument link
    let document_type = null;
    if (deedTypeMapped === "Warranty Deed") {
      document_type = "ConveyanceDeedWarrantyDeed";
    } else if (deedTypeMapped === "Quitclaim Deed") {
      document_type = "ConveyanceDeedQuitClaimDeed";
    } else {
      document_type = "ConveyanceDeed";
    }

    const nameId = row.instLink
      ? (row.instLink.split("=")[2] || `${i}`).trim()
      : `${i}`;
    const fileObj = {
      document_type: document_type,
      file_format: null,
      ipfs_url: null,
      name: `Instrument ${nameId}`,
      original_url: sanitizeHttpUrl(row.instLink),
    };
    writeJSON(path.join(dataDir, `file_${i}.json`), fileObj);

    // relationships for this triple (numbered)
    writeJSON(path.join(dataDir, `relationship_sales_deed_${i}.json`), {
      to: { "/": `./sales_${i}.json` },
      from: { "/": `./deed_${i}.json` },
    });
    writeJSON(path.join(dataDir, `relationship_deed_file_${i}.json`), {
      to: { "/": `./deed_${i}.json` },
      from: { "/": `./file_${i}.json` },
    });
  });

  // Also create canonical relationship files for the most recent entry (index 1)
  if (salesRows.length > 0) {
    writeJSON(path.join(dataDir, "relationship_sales_deed.json"), {
      to: { "/": `./sales_1.json` },
      from: { "/": `./deed_1.json` },
    });
    writeJSON(path.join(dataDir, "relationship_deed_file.json"), {
      to: { "/": `./deed_1.json` },
      from: { "/": `./file_1.json` },
    });
  }

  // Structure from HTML only (limited mapping)
  const styleTxt = getNextTextAfterStrong($, "Style:") || null;
  const wallExt = getNextTextAfterStrong($, "Exterior Wall:") || "";
  const foundationTxt = getNextTextAfterStrong($, "Foundation:") || "";
  const roofCoverTxt = getNextTextAfterStrong($, "Roof Cover:") || "";
  const roofTypeTxt = getNextTextAfterStrong($, "Roof Type:") || "";

  function mapAttachmentFromStyle(style) {
    if (!style) return null;
    if (style.toUpperCase().includes("TOWNHOUSE")) return "Attached";
    return null;
  }
  function mapExteriorPrimary(s) {
    if (/CONCRETE BLOCK/i.test(s)) return "Concrete Block";
    return null;
  }
  function mapExteriorSecondary(s) {
    if (/STUCCO/i.test(s)) return "Stucco Accent";
    return null;
  }
  function mapFoundationType(s) {
    if (/SLAB/i.test(s)) return "Slab on Grade";
    return null;
  }
  function mapFoundationMaterial(s) {
    if (/CONCRETE/i.test(s)) return "Poured Concrete";
    return null;
  }
  function mapRoofDesign(s) {
    if (/HIP/i.test(s)) return "Hip";
    if (/GABLE/i.test(s)) return "Gable";
    return null;
  }
  function mapRoofCovering(s) {
    if (/ARCHITECTURAL/i.test(s)) return "Architectural Asphalt Shingle";
    if (/ASPHALT SHINGLE/i.test(s)) return "Architectural Asphalt Shingle";
    return null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: mapAttachmentFromStyle(styleTxt),
    exterior_wall_material_primary: mapExteriorPrimary(wallExt),
    exterior_wall_material_secondary: mapExteriorSecondary(wallExt),
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
    roof_covering_material: mapRoofCovering(roofCoverTxt),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofTypeTxt),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: mapFoundationType(foundationTxt),
    foundation_material: mapFoundationMaterial(foundationTxt),
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
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utility.json from owners/utilities_data.json
  const utilsKey = `property_${seed.request_identifier || parcelId}`; // prefer altkey
  const utilsCandidate =
    utilsData[utilsKey] ||
    utilsData[`property_${parcelId}`] ||
    utilsData[`property_${seed.parcel_id}`] ||
    null;
  if (utilsCandidate) {
    writeJSON(path.join(dataDir, "utility.json"), utilsCandidate);
  }

  // Layouts from owners/layout_data.json
  const layoutKey = `property_${seed.request_identifier || parcelId}`;
  const layoutCandidate = layoutData[layoutKey];
  if (layoutCandidate && Array.isArray(layoutCandidate.layouts)) {
    layoutCandidate.layouts.forEach((lay, idx) => {
      writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), lay);
    });
  }

  // Owners from owners/owner_data.json
  const ownersKey = `property_${seed.parcel_id}`;
  const ownerObj = ownersData[ownersKey];
  if (
    ownerObj &&
    ownerObj.owners_by_date &&
    Array.isArray(ownerObj.owners_by_date.current)
  ) {
    const currentOwners = ownerObj.owners_by_date.current;
    currentOwners.forEach((o, idx) => {
      if (o.type === "person") {
        const person = {
          birth_date: null,
          first_name: o.first_name || null,
          last_name: o.last_name || null,
          middle_name: o.middle_name || null,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        writeJSON(path.join(dataDir, `person_${idx + 1}.json`), person);
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        writeJSON(path.join(dataDir, `company_${idx + 1}.json`), company);
      }
    });
    // Link current owner to the most recent sale
    if (
      currentOwners.length > 0 &&
      fs.existsSync(path.join(dataDir, "sales_1.json"))
    ) {
      if (currentOwners[0].type === "person") {
        writeJSON(path.join(dataDir, "relationship_sales_person.json"), {
          to: { "/": "./person_1.json" },
          from: { "/": "./sales_1.json" },
        });
      } else if (currentOwners[0].type === "company") {
        writeJSON(path.join(dataDir, "relationship_sales_company.json"), {
          to: { "/": "./company_1.json" },
          from: { "/": "./sales_1.json" },
        });
      }
    }
  }

  // Lot.json - absent data -> nulls
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // Flood storm information - absent -> nulls, boolean false
  const flood = {
    community_id: null,
    panel_number: null,
    map_version: null,
    effective_date: null,
    evacuation_zone: null,
    flood_zone: null,
    flood_insurance_required: false,
    fema_search_url: null,
  };
  writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
}

try {
  main();
  console.log("Script executed successfully.");
} catch (e) {
  try {
    JSON.parse(e.message);
    console.error(e.message);
  } catch {
    console.error(e.stack || String(e));
  }
  process.exit(1);
}
