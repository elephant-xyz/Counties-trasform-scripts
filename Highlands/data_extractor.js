const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) {
    fs.unlinkSync(path.join(p, f));
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : null;
}

function extractParcelIdentifier($) {
  const h2 = $('h2:contains("Parcel")').first().text();
  const m = h2.match(/Parcel\s+([A-Z0-9\-]+)/i);
  return m ? m[1] : null;
}

function extractLegalDescription($) {
  let legal = null;
  const legalB = $("b")
    .filter((i, el) => $(el).text().trim() === "Legal Description")
    .first();
  if (legalB && legalB.length) {
    let texts = [];
    let node = legalB[0].nextSibling;
    while (node) {
      if (
        node.type === "tag" &&
        (node.name === "b" || node.name === "hr" || node.name === "h3")
      )
        break;
      if (node.type === "text") {
        const t = (node.data || "").replace(/\s+/g, " ").trim();
        if (t) texts.push(t);
      } else if (node.type === "tag") {
        const $n = $(node);
        let t = $n.text();
        t = (t || "").replace(/\s+/g, " ").trim();
        if (t) texts.push(t);
      }
      node = node.nextSibling;
    }
    legal = texts.filter(Boolean).join(" ").trim();
    if (legal) legal = legal.replace(/^Legal Description\s*/i, "").trim();
  }
  return legal || null;
}

function extractZoning($) {
  const landH3 = $('h3:contains("Land Lines")');
  let zone = null;
  landH3.each((i, el) => {
    const table = $(el).nextAll("div.table-responsive").first().find("table");
    const tr = table.find("tr").eq(1);
    const td = tr.find("td").eq(3);
    const z = td.text().trim();
    if (z) zone = z;
  });
  return zone || null;
}

function extractAYBYears($) {
  const years = [];
  $('h3:contains("Buildings")')
    .parent()
    .find("table")
    .each((i, tbl) => {
      const $tbl = $(tbl);
      const thead = $tbl.find("thead");
      if (!thead.length) return;
      const headerCells = thead.find("tr").last().find("th");
      let aybIndex = -1;
      headerCells.each((j, th) => {
        if ($(th).text().trim().toUpperCase() === "AYB") aybIndex = j;
      });
      if (aybIndex >= 0) {
        const row = $tbl.find("tr").eq(1);
        if (row && row.length) {
          const yTxt = row.find("td").eq(aybIndex).text().trim();
          const y = parseInt(yTxt, 10);
          if (!isNaN(y)) years.push(y);
        }
      }
    });
  return years;
}

function extractUnitsTotal($) {
  let txt = "";
  $("div").each((i, el) => {
    const t = $(el).text();
    if (t && /TOTAL\s*=\s*\d+\s*UNITS/i.test(t)) {
      txt = t;
      return false;
    }
  });
  if (txt) {
    const m = txt.match(/TOTAL\s*=\s*(\d+)\s*UNITS/i);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function extractDorCode($) {
  let code = null,
    label = null;
  $('b:contains("DOR Code:")').each((i, el) => {
    const a = $(el).nextAll("a").first();
    if (a && a.length) {
      const t = a.text().trim();
      const m = t.match(/^(\d+)\s*\-/);
      if (m) {
        code = m[1];
        label = t;
      }
    }
  });
  return { code, label };
}

function mapDorToPropertyType(dorCode) {
  const map = {
    "00": "VacantLand",
    "01": "SingleFamily",
    "02": "MobileHome",
    "03": "MultiFamilyMoreThan10",
    "04": "Condominium",
    "05": "Cooperative",
    "06": "RetirementHome",
    "07": "MiscellaneousResidential",
    "08": "MultiFamilyLessThan10",
    "09": "CommonElementsArea",
    "10": "VacantCommercial",
    "11": "RetailStore",
    "12": "MixedUse",
    "13": "DepartmentStore",
    "14": "Supermarket",
    "15": "ShoppingCenterRegional",
    "16": "ShoppingCenterCommunity",
    "17": "OfficeBuildingOneStory",
    "18": "OfficeBuildingMultiStory",
    "19": "ProfessionalBuilding",
    "20": "AirportBusTerminal",
    "21": "RestaurantCafe",
    "22": "DriveInRestaurant",
    "23": "FinancialInstitution",
    "24": "InsuranceCompanyOffice",
    "25": "RepairServiceNonAuto",
    "26": "ServiceStation",
    "27": "VehicleSalesServiceRent",
    "28": "ParkingLotMobileHomePark",
    "29": "WholesaleOutletProduct",
    "30": "FloristGreenhouse",
    "31": "DriveInTheaterOpenStadium",
    "32": "EnclosedTheaterAuditorium",
    "33": "NightclubBar",
    "34": "BowlingAlleySkatingRinkPoolHall",
    "35": "TouristAttractionPermanent",
    "36": "Camp",
    "37": "RaceTrack",
    "38": "GolfCourse",
    "39": "HotelMotel",
    "40": "VacantIndustrial",
    "41": "LightManufacturing",
    "42": "HeavyManufacturing",
    "43": "LumberYard",
    "44": "PackingPlant",
    "45": "CanneryBottler",
    "46": "OtherFoodProcessing",
    "47": "MineralProcessing",
    "48": "WarehouseStorageDistribution",
    "49": "OpenStorage",
    "50": "ImprovedAgriculture",
    "51": "CroplandSoilCap1",
    "52": "CroplandSoilCap2",
    "53": "CroplandSoilCap3",
    "54": "Timberland90Plus",
    "55": "Timberland80_89",
    "56": "Timberland70_79",
    "57": "Timberland60_69",
    "58": "Timberland50_59",
    "59": "TimberlandNonClassified",
    "60": "GrazingSoilCap1",
    "61": "GrazingSoilCap2",
    "62": "GrazingSoilCap3",
    "63": "GrazingSoilCap4",
    "64": "GrazingSoilCap5",
    "65": "GrazingSoilCap6",
    "66": "GrovesOrchards",
    "67": "PoultryBeesFish",
    "68": "DairiesFeedLots",
    "69": "OrnamentalsMisc",
    "70": "VacantInstitutional",
    "71": "Church",
    "72": "PrivateSchool",
    "73": "PrivateHospital",
    "74": "HomeForTheAged",
    "75": "NonProfitService",
    "76": "MortuaryCemetery",
    "77": "ClubLodgeHall",
    "78": "RestHome",
    "79": "CulturalGroup",
    "80": "VacantGovernmental",
    "81": "Military",
    "82": "ForestParkRecreation",
    "83": "PublicSchool",
    "84": "College",
    "85": "Hospital",
    "86": "County",
    "87": "State",
    "88": "Federal",
    "89": "Municipal",
    "90": "LeaseholdInterest",
    "91": "Utility",
    "92": "Mining",
    "93": "SubSurfaceRights",
    "94": "RightOfWay",
    "95": "RiverAndLake",
    "96": "WastelandDump",
    "97": "RecreationAndParkLand",
    "9801": "CentrallyAssessed",
    "9802": "CentrallyAssessedActiveRoW",
    "99": "NonAgriculturalAcreage",
  };
  return map[dorCode] || null;
}

function extractTopAddressBlock($) {
  const p = $("div.row").find("p").first();
  if (!p || !p.length) return [];
  const html = p.html() || "";
  const normalized = html.replace(/<br\s*\/?>/gi, "\n");
  const lines = normalized
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((l) => l && l !== "/>");
  return lines;
}

function parseFullAddressParts(fullAddress) {
  const s = ((full_address) =>
    (full_address || "").replace(/\s+/g, " ").trim())(fullAddress);
  const m = s.match(
    /(.+?)\s*([A-Z\s\-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/,
  );
  if (!m) return null;
  const streetPart = m[1].trim();
  const city = m[2].trim();
  const state = m[3];
  const zip = m[4];
  const plus4 = m[5] || null;
  return { streetPart, city, state, zip, plus4 };
}

function mapStreetSuffix(raw) {
  if (!raw) return null;
  const up = raw.toUpperCase();
  const map = {
    ST: "St",
    "ST.": "St",
    RD: "Rd",
    "RD.": "Rd",
    DR: "Dr",
    "DR.": "Dr",
    AVE: "Ave",
    "AVE.": "Ave",
    BLVD: "Blvd",
    "BLVD.": "Blvd",
    HWY: "Hwy",
    CT: "Ct",
    LN: "Ln",
    PL: "Pl",
    TER: "Ter",
    // Add more common suffixes if needed
  };
  if (map[up]) return map[up];
  // Only throw error if it's a known suffix that's not mapped, otherwise return null
  // for cases where the last token isn't a suffix.
  // For now, we'll keep the error to catch unhandled cases.
  throw new Error(
    JSON.stringify({
      type: "error",
      message: `Unknown enum value ${raw}.`,
      path: "address.street_suffix_type",
    }),
  );
}

function parseCityStateZip(line) {
  if (!line) return null;
  const m = line
    .trim()
    .match(/^([A-Z \-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/i);
  if (!m) return null;
  return {
    city: m[1].toUpperCase(),
    state: m[2].toUpperCase(),
    zip: m[3],
    plus4: m[4] || null,
  };
}

function parseStreetLine(line) {
  if (!line) return null;
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  let street_number = null;
  let street_pre_directional_text = null;
  let street_name_tokens = [];
  let street_suffix_type = null;
  let street_post_directional_text = null;

  // Attempt to parse street number
  if (tokens[0].match(/^\d+$/)) {
    street_number = tokens.shift();
  }

  // Check for pre-directional (e.g., N, S, E, W)
  const directionalMap = {
    N: "N",
    S: "S",
    E: "E",
    W: "W",
    NE: "NE",
    NW: "NW",
    SE: "SE",
    SW: "SW",
  };
  if (tokens.length > 0 && directionalMap[tokens[0].toUpperCase()]) {
    street_pre_directional_text = directionalMap[tokens.shift().toUpperCase()];
  }

  // Check for post-directional (e.g., N, S, E, W) at the end
  if (tokens.length > 0 && directionalMap[tokens[tokens.length - 1].toUpperCase()]) {
    street_post_directional_text = directionalMap[tokens.pop().toUpperCase()];
  }

  // Attempt to parse street suffix from the end of remaining tokens
  if (tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1];
    try {
      street_suffix_type = mapStreetSuffix(lastToken);
      if (street_suffix_type) {
        tokens.pop(); // Remove suffix if successfully mapped
      } else {
        // If mapStreetSuffix throws an error, it means it's an unhandled suffix,
        // so we'll treat it as part of the street name for now.
        // Or, if it returns null, it's not a suffix.
        street_name_tokens.push(lastToken);
      }
    } catch (e) {
      // If mapStreetSuffix throws an error, it's an unknown suffix,
      // so we'll treat it as part of the street name.
      street_name_tokens.push(lastToken);
    }
  }

  street_name_tokens = tokens; // Remaining tokens are the street name

  return {
    street_number: street_number,
    street_name: street_name_tokens.join(" ").trim() || null,
    street_suffix_type: street_suffix_type,
    street_pre_directional_text: street_pre_directional_text,
    street_post_directional_text: street_post_directional_text,
  };
}


function extractLandFrontDepth($) {
  const table = $('h3:contains("Land Lines")').parent().find("table").first();
  if (!table || !table.length) return { front: null, depth: null };
  const tr = table.find("tr").eq(1);
  const tds = tr.find("td");
  if (tds.length < 6) return { front: null, depth: null };
  const frontTxt = tds.eq(4).text().trim();
  const depthTxt = tds.eq(5).text().trim();
  const front = frontTxt
    ? Math.round(parseFloat(frontTxt.replace(/,/g, "")))
    : null;
  const depth = depthTxt
    ? Math.round(parseFloat(depthTxt.replace(/,/g, "")))
    : null;
  return {
    front: Number.isFinite(front) ? front : null,
    depth: Number.isFinite(depth) ? depth : null,
  };
}

function extractStructureHints($) {
  let roofDesign = null;
  let roofCoverDesc = null;
  let interiorFloorDesc = null;
  let heatingTypeDesc = null;
  let coolingTypeDesc = null;
  $("table").each((i, tbl) => {
    const rows = $(tbl).find("tr");
    rows.each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 3) {
        const elem = tds.eq(0).text().trim();
        const desc = tds.eq(2).text().trim();
        if (elem === "Roof Structure") roofDesign = desc;
        if (elem === "Roof Cover") roofCoverDesc = desc;
        if (elem === "Interior Flooring") interiorFloorDesc = desc;
        if (elem === "Heating Type") heatingTypeDesc = desc;
        if (elem === "Air Cond. Type") coolingTypeDesc = desc;
      }
    });
  });
  return {
    roofDesign,
    roofCoverDesc,
    interiorFloorDesc,
    heatingTypeDesc,
    coolingTypeDesc,
  };
}

function main() {
  ensureDir("data");
  clearDir("data");

  const inputHtml = fs.readFileSync("input.html", "utf8");
  const unnormalized = readJson("unnormalized_address.json");
  const seed = readJson("property_seed.json");

  const ownersData = readJson(path.join("owners", "owner_data.json"));
  const utilitiesData = readJson(path.join("owners", "utilities_data.json"));
  const layoutData = readJson(path.join("owners", "layout_data.json"));

  const $ = cheerio.load(inputHtml);

  const parcelIdentifier = extractParcelIdentifier($);
  const legalDesc = extractLegalDescription($);
  const zoning = extractZoning($);
  const aybYears = extractAYBYears($);
  const propertyBuiltYear = aybYears.length ? Math.min(...aybYears) : null;
  const unitsTotal = extractUnitsTotal($);
  const dor = extractDorCode($);
  const propertyType = dor.code ? mapDorToPropertyType(dor.code) : null;

  if (!propertyType)
    throw new Error(
      JSON.stringify({
        type: "error",
        message: `Unknown enum value for DOR Code ${dor.code || "N/A"}.`,
        path: "property.property_type",
      }),
    );

  const property = {
    area_under_air: null,
    historic_designation: false,
    livable_floor_area: null,
    number_of_units: unitsTotal || null,
    number_of_units_type: null,
    parcel_identifier: parcelIdentifier || (seed && seed.parcel_id) || "",
    property_effective_built_year: null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: propertyBuiltYear || null,
    property_type: propertyType,
    subdivision: null,
    total_area: null,
    zoning: zoning || null,
  };
  writeJson(path.join("data", "property.json"), property);

  // Address
  const lines = extractTopAddressBlock($);
  const address = {
    block: null,
    city_name: null,
    country_code: "US",
    county_name:
      unnormalized && unnormalized.county_jurisdiction
        ? unnormalized.county_jurisdiction
        : null,
    latitude: null,
    longitude: null,
    lot: null,
    municipality_name: null,
    plus_four_postal_code: null,
    postal_code: null,
    range: null,
    request_identifier: null, // Added as per schema
    route_number: null,
    section: null,
    state_code: null,
    street_name: null,
    street_number: null,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_suffix_type: null,
    township: null,
    unit_identifier: null,
    source_http_request: { // Added as per schema
      method: "GET",
      url: "http://example.com/address_data" // Placeholder, replace with actual source if available
    }
  };

  if (lines.length >= 2) {
    const street = parseStreetLine(lines[0]);
    const csz = parseCityStateZip(lines[1]);
    if (street) {
      address.street_number = street.street_number;
      address.street_name = street.street_name;
      address.street_suffix_type = street.street_suffix_type;
      address.street_pre_directional_text = street.street_pre_directional_text;
      address.street_post_directional_text = street.street_post_directional_text;
    }
    if (csz) {
      address.city_name = csz.city;
      address.state_code = csz.state;
      address.postal_code = csz.zip;
      address.plus_four_postal_code = csz.plus4;
    }
  }
  if (!address.city_name || !address.state_code || !address.postal_code) {
    const pText = $("div.row")
      .find("p")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const m = pText.match(/([A-Z \-']+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?/i);
    if (m) {
      address.city_name = m[1].toUpperCase();
      address.state_code = m[2].toUpperCase();
      address.postal_code = m[3];
      address.plus_four_postal_code =
        address.plus_four_postal_code || m[4] || null;
    }
  }
  if (
    !address.city_name ||
    !address.state_code ||
    !address.postal_code ||
    !address.street_number ||
    !address.street_suffix_type ||
    !address.street_name
  ) {
    const parts = parseFullAddressParts(unnormalized.full_address || "");
    if (parts) {
      const { streetPart, city, state, zip, plus4 } = parts;
      if (!address.city_name) address.city_name = (city || "").toUpperCase();
      if (!address.state_code) address.state_code = state;
      if (!address.postal_code) address.postal_code = zip;
      if (!address.plus_four_postal_code) address.plus_four_postal_code = plus4;
      if (
        !address.street_number ||
        !address.street_suffix_type ||
        !address.street_name ||
        !address.street_pre_directional_text ||
        !address.street_post_directional_text
      ) {
        const streetParsed = parseStreetLine(streetPart);
        if (streetParsed) {
          if (!address.street_number) address.street_number = streetParsed.street_number;
          if (!address.street_name) address.street_name = streetParsed.street_name;
          if (!address.street_suffix_type) address.street_suffix_type = streetParsed.street_suffix_type;
          if (!address.street_pre_directional_text) address.street_pre_directional_text = streetParsed.street_pre_directional_text;
          if (!address.street_post_directional_text) address.street_post_directional_text = streetParsed.street_post_directional_text;
        }
      }
    }
  }
  lines.forEach((line) => {
    const m = line.match(/\bLT\s+(\w+)/i);
    if (m) address.lot = m[1];
  });
  if (legalDesc) {
    const mblk = legalDesc.match(/\bBLK\s+(\w+)/i);
    if (mblk) address.block = mblk[1];
  }
  if (parcelIdentifier) {
    const m = parcelIdentifier.match(/P\-(\d{2})\-(\d{2})\-(\d{2})/i);
    if (m) {
      address.section = m[1];
      address.township = m[2];
      address.range = m[3];
    }
  }
  writeJson(path.join("data", "address.json"), address);

  // Taxes
  const valueSummary = (() => {
    const table = $('h3:contains("Value Summary")')
      .closest("div")
      .nextAll("table")
      .first();
    const map = {};
    table.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = tds.eq(0).text().trim();
        const val = tds.eq(1).text().trim();
        if (label) map[label] = val;
      }
    });
    return map;
  })();
  const taxableSummary = (() => {
    const table = $('h3:contains("Taxable Value Summary")')
      .closest("div")
      .nextAll("table")
      .first();
    const map = {};
    table.find("tr").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = tds.eq(0).text().trim();
        const val = tds.eq(1).text().trim();
        if (label) map[label] = val;
      }
    });
    return map;
  })();
  const totalBuildingVal = parseCurrencyToNumber(
    valueSummary["Total Building Value"],
  );
  const totalLandVal = parseCurrencyToNumber(valueSummary["Total Land Value"]);
  const totalJustVal = parseCurrencyToNumber(valueSummary["Total Just Value"]);
  const totalAssessed = parseCurrencyToNumber(
    taxableSummary["Total Assessed (Capped) Value"],
  );
  const totalTaxable = parseCurrencyToNumber(
    taxableSummary["Total Taxable Value"],
  );
  const tax = {
    tax_year: new Date().getFullYear(),
    property_assessed_value_amount: totalAssessed,
    property_market_value_amount: totalJustVal,
    property_building_amount: totalBuildingVal,
    property_land_amount: totalLandVal,
    property_taxable_value_amount: totalTaxable,
    monthly_tax_amount: null,
    period_end_date: null,
    period_start_date: null,
    yearly_tax_amount: null,
    first_year_building_on_tax_roll: null,
    first_year_on_tax_roll: null,
  };
  writeJson(path.join("data", "tax_1.json"), tax);

  // Sales
  const salesRows = (() => {
    const rows = [];
    const table = $('h3:contains("Sales History")')
      .parent()
      .find("table")
      .first();
    table.find("tr").each((i, tr) => {
      if (i === 0 || i === 1) return;
      const tds = $(tr).find("td");
      if (tds.length < 9) return;
      const book = tds.eq(0).text().trim();
      const page = tds.eq(1).text().trim();
      const month = tds.eq(2).text().trim();
      const year = tds.eq(3).text().trim();
      const inst = tds.eq(4).text().trim();
      const priceTxt = tds.eq(8).text().trim();
      const orLink = tds.eq(0).find("a").attr("href") || null;
      if (!year) return;
      const mm = (month && month.padStart(2, "0")) || "01";
      const dateStr = `${year}-${mm}-01`;
      const price = parseCurrencyToNumber(priceTxt);
      rows.push({ book, page, month, year, inst, price, dateStr, orLink });
    });
    return rows;
  })();

  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    writeJson(path.join("data", `sales_${saleIdx}.json`), {
      ownership_transfer_date: row.dateStr,
      purchase_price_amount: row.price,
    });
  });

  // Deeds, Files, Relationships
  salesRows.forEach((row, idx) => {
    const saleIdx = idx + 1;
    const deedIdx = saleIdx;
    const fileIdx = saleIdx;
    const instUp = (row.inst || "").toUpperCase();
    let deedType = null;
    if (instUp === "WD") {
      deedType = "Warranty Deed";
    } else if (!instUp || instUp === "") {
      if (row.price === 1) deedType = "Quitclaim Deed";
      else deedType = "Warranty Deed";
    }
    const deedObj = {};
    if (deedType) deedObj.deed_type = deedType;
    writeJson(path.join("data", `deed_${deedIdx}.json`), deedObj);

    if (row.orLink) {
      writeJson(path.join("data", `file_${fileIdx}.json`), {
        file_format: "txt",
        name: `OR ${row.book}/${row.page}`,
        original_url: row.orLink,
        ipfs_url: null,
        document_type:
          deedType === "Warranty Deed"
            ? "ConveyanceDeedWarrantyDeed"
            : "ConveyanceDeed",
      });
      if (idx === 0) {
        writeJson(path.join("data", "relationship_deed_file.json"), {
          to: { "/": `./deed_${deedIdx}.json` },
          from: { "/": `./file_${fileIdx}.json` },
        });
      } else {
        writeJson(path.join("data", `relationship_deed_file_${saleIdx}.json`), {
          to: { "/": `./deed_${deedIdx}.json` },
          from: { "/": `./file_${fileIdx}.json` },
        });
      }
    }
    if (idx === 0) {
      writeJson(path.join("data", "relationship_sales_deed.json"), {
        to: { "/": `./sales_${saleIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      });
    } else {
      writeJson(path.join("data", `relationship_sales_deed_${saleIdx}.json`), {
        to: { "/": `./sales_${saleIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      });
    }
  });

  // Owners and relationship to most recent sale
  const ownerKey = `property_${parcelIdentifier}`;
  const fallbackOwnerKey = Object.keys(ownersData).find((k) =>
    k.endsWith(parcelIdentifier),
  );
  const ownerEntry = ownersData[ownerKey] || ownersData[fallbackOwnerKey];
  let ownerType = null;
  if (
    ownerEntry &&
    ownerEntry.owners_by_date &&
    ownerEntry.owners_by_date.current &&
    ownerEntry.owners_by_date.current.length
  ) {
    const o = ownerEntry.owners_by_date.current[0];
    if (o.type === "company") {
      ownerType = "company";
      writeJson(path.join("data", "company_1.json"), { name: o.name || null });
    } else if (o.type === "person") {
      ownerType = "person";
      writeJson(path.join("data", "person_1.json"), {
        birth_date: null,
        first_name: o.first_name || null,
        last_name: o.last_name || null,
        middle_name: null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      });
    }
  }
  if (ownerType && salesRows.length > 0) {
    if (ownerType === "company")
      writeJson(path.join("data", "relationship_sales_company.json"), {
        to: { "/": "./company_1.json" },
        from: { "/": "./sales_1.json" },
      });
    else
      writeJson(path.join("data", "relationship_sales_person.json"), {
        to: { "/": "./person_1.json" },
        from: { "/": "./sales_1.json" },
      });
  }

  // Utilities normalization (respect owners/utilities_data.json but adjust ElectricFurnace to Central if HTML shows Force Air)
  const utilEntryRaw =
    utilitiesData[ownerKey] || utilitiesData[fallbackOwnerKey] || null;
  const hints = extractStructureHints($);
  if (utilEntryRaw) {
    const utilOut = { ...utilEntryRaw };
    if (
      (utilOut.heating_system_type == null ||
        utilOut.heating_system_type === "ElectricFurnace") &&
      hints.heatingTypeDesc &&
      /Force\s*Air/i.test(hints.heatingTypeDesc)
    ) {
      utilOut.heating_system_type = "Central";
    }
    if (
      utilOut.cooling_system_type == null &&
      hints.coolingTypeDesc &&
      /Central/i.test(hints.coolingTypeDesc)
    ) {
      utilOut.cooling_system_type = "CentralAir";
    }
    writeJson(path.join("data", "utility.json"), {
      cooling_system_type: utilOut.cooling_system_type ?? null,
      electrical_panel_capacity: utilOut.electrical_panel_capacity ?? null,
      electrical_panel_installation_date:
        utilOut.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilOut.electrical_rewire_date ?? null,
      electrical_wiring_type: utilOut.electrical_wiring_type ?? null,
      electrical_wiring_type_other_description:
        utilOut.electrical_wiring_type_other_description ?? null,
      heating_system_type: utilOut.heating_system_type ?? null,
      hvac_capacity_kw: utilOut.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilOut.hvac_capacity_tons ?? null,
      hvac_condensing_unit_present:
        utilOut.hvac_condensing_unit_present ?? null,
      hvac_equipment_component: utilOut.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: utilOut.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilOut.hvac_equipment_model ?? null,
      hvac_installation_date: utilOut.hvac_installation_date ?? null,
      hvac_seer_rating: utilOut.hvac_seer_rating ?? null,
      hvac_system_configuration: utilOut.hvac_system_configuration ?? null,
      hvac_unit_condition: utilOut.hvac_unit_condition ?? null,
      hvac_unit_issues: utilOut.hvac_unit_issues ?? null,
      plumbing_system_installation_date:
        utilOut.plumbing_system_installation_date ?? null,
      plumbing_system_type: utilOut.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utilOut.plumbing_system_type_other_description ?? null,
      public_utility_type: utilOut.public_utility_type ?? null,
      sewer_connection_date: utilOut.sewer_connection_date ?? null,
      sewer_type: utilOut.sewer_type ?? null,
      smart_home_features: utilOut.smart_home_features ?? null,
      smart_home_features_other_description:
        utilOut.smart_home_features_other_description ?? null,
      solar_installation_date: utilOut.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utilOut.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: utilOut.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilOut.solar_inverter_model ?? null,
      solar_inverter_visible: utilOut.solar_inverter_visible ?? null,
      solar_panel_present: utilOut.solar_panel_present ?? null,
      solar_panel_type: utilOut.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utilOut.solar_panel_type_other_description ?? null,
      water_connection_date: utilOut.water_connection_date ?? null,
      water_heater_installation_date:
        utilOut.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilOut.water_heater_manufacturer ?? null,
      water_heater_model: utilOut.water_heater_model ?? null,
      water_source_type: utilOut.water_source_type ?? null,
      well_installation_date: utilOut.well_installation_date ?? null,
    });
  }

  // Layouts
  let layoutOwnerKey = `property_${parcelIdentifier}`;
  let layoutEntry = layoutData[layoutOwnerKey];
  if (!layoutEntry) {
    const k = Object.keys(layoutData).find((k) => k.endsWith(parcelIdentifier));
    if (k) layoutEntry = layoutData[k];
  }
  if (!layoutEntry) {
    let bestKey = null;
    let bestLen = -1;
    for (const [k, v] of Object.entries(layoutData)) {
      const len = Array.isArray(v.layouts) ? v.layouts.length : 0;
      if (len > bestLen) {
        bestLen = len;
        bestKey = k;
      }
    }
    if (bestKey) layoutEntry = layoutData[bestKey];
  }
  if (layoutEntry && Array.isArray(layoutEntry.layouts)) {
    layoutEntry.layouts.forEach((lay, idx) => {
      const layout = {
        bathroom_renovation_date: lay.bathroom_renovation_date ?? null,
        cabinet_style: lay.cabinet_style ?? null,
        clutter_level: lay.clutter_level ?? null,
        condition_issues: lay.condition_issues ?? null,
        countertop_material: lay.countertop_material ?? null,
        decor_elements: lay.decor_elements ?? null,
        design_style: lay.design_style ?? null,
        fixture_finish_quality: lay.fixture_finish_quality ?? null,
        floor_level: lay.floor_level ?? null,
        flooring_installation_date: lay.flooring_installation_date ?? null,
        flooring_material_type: lay.flooring_material_type ?? null,
        flooring_wear: lay.flooring_wear ?? null,
        furnished: lay.furnished ?? null,
        has_windows: lay.has_windows ?? null,
        is_exterior: lay.is_exterior ?? false,
        is_finished: lay.is_finished ?? false,
        kitchen_renovation_date: lay.kitchen_renovation_date ?? null,
        lighting_features: lay.lighting_features ?? null,
        natural_light_quality: lay.natural_light_quality ?? null,
        paint_condition: lay.paint_condition ?? null,
        pool_condition: lay.pool_condition ?? null,
        pool_equipment: lay.pool_equipment ?? null,
        pool_installation_date: lay.pool_installation_date ?? null,
        pool_surface_type: lay.pool_surface_type ?? null,
        pool_type: lay.pool_type ?? null,
        pool_water_quality: lay.pool_water_quality ?? null,
        safety_features: lay.safety_features ?? null,
        size_square_feet: lay.size_square_feet ?? null,
        spa_installation_date: lay.spa_installation_date ?? null,
        spa_type: lay.spa_type ?? null,
        space_index: lay.space_index,
        space_type: lay.space_type ?? null,
        view_type: lay.view_type ?? null,
        visible_damage: lay.visible_damage ?? null,
        window_design_type: lay.window_design_type ?? null,
        window_material_type: lay.window_material_type ?? null,
        window_treatment_type: lay.window_treatment_type ?? null,
      };
      writeJson(path.join("data", `layout_${idx + 1}.json`), layout);
    });
  }

  // Structure mapping
  const hints2 = extractStructureHints($);
  let roof_design_type = null;
  if (hints2.roofDesign) {
    if (/Gable/i.test(hints2.roofDesign)) roof_design_type = "Gable";
    else if (/Hip/i.test(hints2.roofDesign)) roof_design_type = "Hip";
  }
  let roof_covering_material = null;
  if (hints2.roofCoverDesc && /Metal/i.test(hints2.roofCoverDesc)) {
    roof_covering_material = "Metal Standing Seam";
  }
  let flooring_material_primary = null;
  if (hints2.interiorFloorDesc) {
    if (/Cork/i.test(hints2.interiorFloorDesc))
      flooring_material_primary = "Cork";
    else if (/Vinyl/i.test(hints2.interiorFloorDesc))
      flooring_material_primary = "Sheet Vinyl";
  }
  const structure = {
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
    exterior_wall_insulation_type: "Unknown",
    exterior_wall_insulation_type_primary: "Unknown",
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: null,
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: flooring_material_primary,
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
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: roof_covering_material,
    roof_date: null,
    roof_design_type: roof_design_type,
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
  // Set exterior wall and interior wall where found
  $("table").each((i, tbl) => {
    const rows = $(tbl).find("tr");
    rows.each((ri, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 3) {
        const elem = tds.eq(0).text().trim();
        const desc = tds.eq(2).text().trim();
        if (elem === "Exterior Wall" && desc === "Concrete Block")
          structure.exterior_wall_material_primary = "Concrete Block";
        if (elem === "Interior Wall" && desc === "Drywall")
          structure.interior_wall_surface_material_primary = "Drywall";
      }
    });
  });
  writeJson(path.join("data", "structure.json"), structure);

  // Lot
  const ld = extractLandFrontDepth($);
  const lot = {
    driveway_condition: null,
    driveway_material: null,
    fence_height: null,
    fence_length: null,
    fencing_type: null,
    landscaping_features: null,
    lot_area_sqft: null,
    lot_condition_issues: null,
    lot_length_feet: ld.front,
    lot_size_acre: null,
    lot_type: null,
    lot_width_feet: ld.depth,
    view: null,
  };
  writeJson(path.join("data", "lot.json"), lot);
}

try {
  main();
  console.log("Script executed successfully.");
} catch (err) {
  if (err && err.message) {
    try {
      const parsed = JSON.parse(err.message);
      console.error(JSON.stringify(parsed, null, 2));
      process.exit(1);
    } catch (_) {
      console.error(err.stack || String(err));
      process.exit(1);
    }
  } else {
    console.error(String(err));
    process.exit(1);
  }
}
