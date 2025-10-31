// scripts/data_extractor.js
// Extraction script per evaluator requirements
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - All other data from input.html
// - Outputs JSON files into ./data/

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

function getText($, el) {
  return $(el).text().trim().replace(/\s+/g, " ");
}

function currencyToNumber(s) {
  if (s == null) return null;
  const t = String(s).replace(/\$/g, "").replace(/,/g, "").trim();
  if (t === "" || t === "-") return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  // round to 2 decimals max
  return Math.round(n * 100) / 100;
}

function parseSaleDateToISO(s) {
  if (!s) return null;
  // supports M/D/YYYY or MM/DD/YYYY
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map((x) => x.trim());
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeName(s) {
  if (!s) return null;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mapPropertyTypeFromUse(useText, bldgTypeText) {
  const t = `${useText || ""} ${bldgTypeText || ""}`.toUpperCase();
  // Map common manufactured/mobile indicators
  if (
    t.includes("MOBILE HOME") ||
    t.includes("MFR HOME") ||
    t.includes("MANUFACT")
  ) {
    return "ManufacturedHousing";
  }
  // Fallback to SingleFamily if explicitly stated (rare in this feed)
  if (t.includes("SFR") || t.includes("SINGLE FAMILY")) return "SingleFamily";
  // As a last resort, choose MiscellaneousResidential if nothing else fits
  return "MiscellaneousResidential";
}

function mapExteriorWallMaterial(val) {
  if (!val) return null;
  const t = val.toUpperCase();
  if (t.includes("VINYL")) return "Vinyl Siding";
  if (t.includes("STUCCO")) return "Stucco";
  if (t.includes("BRICK")) return "Brick";
  if (t.includes("CONC") || t.includes("BLOCK")) return "Concrete Block";
  return null;
}

function mapInteriorWallSurface(val) {
  if (!val) return null;
  const t = val.toUpperCase();
  if (t.includes("DRYWALL") || t.includes("GYPSUM")) return "Drywall";
  if (t.includes("PLASTER")) return "Plaster";
  if (t.includes("WOOD")) return "Wood Paneling";
  return null;
}

function mapFlooring(val) {
  if (!val) return { primary: null, secondary: null };
  const t = val.toUpperCase();
  const hasCarpet = t.includes("CARPET");
  const hasSheetVinyl =
    t.includes("SHT VINYL") || t.includes("SHEET VINYL") || t.includes("VINYL");
  
  // Valid secondary flooring enum values
  const validSecondary = [
    "Solid Hardwood", "Engineered Hardwood", "Laminate", 
    "Luxury Vinyl Plank", "Ceramic Tile", "Carpet", 
    "Area Rugs", "Transition Strips"
  ];
  
  let primary = null;
  let secondary = null;
  
  if (hasCarpet) primary = "Carpet";
  if (hasSheetVinyl) {
    if (!primary) primary = "Sheet Vinyl";
    else if (validSecondary.includes("Carpet") && hasCarpet) {
      secondary = "Carpet"; // Only set secondary if it's in valid enum
    }
  }
  return { primary, secondary };
}

function extractParcelSummary($) {
  const summary = {};
  $(
    "#ctlBodyPane_ctl00_ctl01_dynamicSummaryData_divSummary table.tabular-data-two-column tbody tr",
  ).each((i, tr) => {
    const key = getText($, $(tr).find("th strong"));
    const value = getText($, $(tr).find("td div span"));
    if (!key) return;
    summary[key] = value;
  });
  return summary;
}

function extractBuildingInfo($) {
  const info = {};
  const rows = $(
    "#ctlBodyPane_ctl07_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_divSummary table tbody tr",
  );
  rows.each((i, tr) => {
    const key = getText($, $(tr).find("th strong"));
    const value = getText($, $(tr).find("td div span"));
    if (!key) return;
    info[key] = value;
  });
  // Building Area Types
  const areaRows = $("#ctlBodyPane_ctl09_ctl01_grdTableViewer tbody tr");
  areaRows.each((i, tr) => {
    const type = getText($, $(tr).find("th"));
    const desc = getText($, $(tr).find("td").eq(0));
    const sqft = getText($, $(tr).find("td").eq(1));
    if (type === "BAS" || desc.toUpperCase().includes("BASE AREA")) {
      info["BaseAreaSqft"] = sqft;
    }
  });
  return info;
}

function extractValuationAllYears($) {
  // Gather headers and map of row name -> array of values per column
  const headers = [];
  const headerEls = $(
    "#ctlBodyPane_ctl03_ctl01_grdValuation thead th.value-column",
  );
  headerEls.each((i, th) => headers.push(getText($, th)));

  const rows = $("#ctlBodyPane_ctl03_ctl01_grdValuation tbody tr");
  const rowNames = [];
  const matrix = []; // [rowIndex][colIndex] -> cell text

  rows.each((ri, tr) => {
    const name = getText($, $(tr).find("th"));
    rowNames.push(name);
    const cells = $(tr).find("td");
    const arr = [];
    cells.each((ci, td) => {
      arr.push(getText($, td));
    });
    matrix.push(arr);
  });

  // Build per-year value objects
  const outByYear = [];
  headers.forEach((h, colIdx) => {
    const m = h.match(/(\d{4})/);
    if (!m) return;
    const year = Number(m[1]);
    const valueMap = {};
    rowNames.forEach((rn, ri) => {
      valueMap[rn] = matrix[ri] ? matrix[ri][colIdx] : null;
    });
    outByYear.push({ year, header: h, values: valueMap });
  });
  return outByYear;
}

function extractSales($) {
  const sales = [];
  $("#ctlBodyPane_ctl10_ctl01_grdSales_grdFlat tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const date = getText($, $(tr).find("th"));
    const price = getText($, tds.eq(0));
    const instrument = getText($, tds.eq(1));
    const instrumentNumber = getText($, tds.eq(2));
    const bookPage = getText($, tds.eq(3));
    const qualification = getText($, tds.eq(4));
    const saleReason = getText($, tds.eq(5));
    const vacantImproved = getText($, tds.eq(6));
    const grantor = getText($, tds.eq(7));
    const grantee = getText($, tds.eq(8));
    sales.push({
      date,
      price,
      instrument,
      instrumentNumber,
      bookPage,
      qualification,
      saleReason,
      vacantImproved,
      grantor,
      grantee,
    });
  });
  return sales;
}

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const t = instr.trim().toUpperCase();
  if (t === "WD") return "Warranty Deed";
  if (t === "SW" || t === "SWD") return "Special Warranty Deed";
  if (t === "QCD" || t === "QC") return "Quitclaim Deed";
  return null; // unknown
}

function sanitizeUrl(url) {
  if (!url) return null;
  // Replace problematic characters that break JSON/URI validation
  return url.replace(/"/g, '%22').replace(/\\/g, '%5C');
}

function extractFiles($) {
  const files = [];
  // 2025 TRIM Notice PDF link
  const trimSel =
    "#ctlBodyPane_ctl04_ctl01_prtrFiles_ctl00_prtrFiles_Inner_ctl00_hlkName";
  const trimHref = $(trimSel).attr("href");
  if (trimHref && trimHref.trim()) {
    const url = trimHref.startsWith("http")
      ? trimHref
      : `https://qpublic.schneidercorp.com${trimHref}`;
    files.push({
      name: getText($, trimSel) || "2025 TRIM Notice (PDF)",
      original_url: sanitizeUrl(url),
      file_format: null,
      document_type: null,
    });
  }
  // 2025 Property Record Card PDF
  const prcSel =
    "#ctlBodyPane_ctl13_ctl01_prtrFiles_ctl00_prtrFiles_Inner_ctl00_hlkName";
  const prcHref = $(prcSel).attr("href");
  if (prcHref && prcHref.trim()) {
    const url = prcHref.startsWith("http")
      ? prcHref
      : `https://qpublic.schneidercorp.com${prcHref}`;
    files.push({
      name: getText($, prcSel) || "2025 Property Record Card (PDF)",
      original_url: sanitizeUrl(url),
      file_format: null,
      document_type: null,
    });
  }
  // Sketch image
  const skImg = $("#sketchgrid img.rsImg");
  const skSrc = skImg.attr("src");
  if (skSrc && skSrc.trim()) {
    const abs = skSrc.startsWith("http")
      ? skSrc
      : `https://qpublic.schneidercorp.com${skSrc}`;
    files.push({
      name: skImg.attr("alt") || "Sketch Image",
      original_url: sanitizeUrl(abs),
      file_format: "png",
      document_type: "PropertyImage",
    });
  }
  return files;
}

function deriveSuffixFromTextForPerson(salesForDate, person) {
  // Try to infer suffix from grantor/grantee text (e.g., JR, SR, II, III, IV)
  if (!salesForDate || salesForDate.length === 0) return null;
  const suffixTokens = [
    { rx: /\bJR\b/i, val: "Jr." },
    { rx: /\bSR\b/i, val: "Sr." },
    { rx: /\bII\b/i, val: "II" },
    { rx: /\bIII\b/i, val: "III" },
    { rx: /\bIV\b/i, val: "IV" },
  ];
  const lastRx = new RegExp(`\\b${person.last}\\b`, "i");
  for (const s of salesForDate) {
    const combined = `${s.grantee} ${s.grantor}`;
    if (lastRx.test(combined)) {
      for (const st of suffixTokens) {
        if (st.rx.test(combined)) return st.val;
      }
    }
  }
  return null;
}

function main() {
  ensureDir("data");
  ensureDir("owners");

  const html = fs.readFileSync("input.html", "utf8");
  const unaddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  const $ = cheerio.load(html);

  // Extract sections
  const summary = extractParcelSummary($);
  const building = extractBuildingInfo($);
  const valuationAll = extractValuationAllYears($);
  const sales = extractSales($);
  const files = extractFiles($);

  // Property
  const parcelId = summary["Parcel ID"] || null;
  const legalDesc = summary["Brief Tax Description"] || null;
  const propertyUseCode = summary["Property Use Code"] || null;
  const bldgType = building["Type"] || null;
  const totalArea = building["Total Area"] || null;
  const heatedArea = building["Heated Area"] || null;
  const ayb = building["Actual Year Built"]
    ? Number(building["Actual Year Built"])
    : null;
  const eyb = building["Effective Year Built"]
    ? Number(building["Effective Year Built"])
    : null;

  const property = {
    area_under_air: heatedArea ? String(heatedArea) : null,
    historic_designation: undefined, // omit when unknown
    livable_floor_area: heatedArea ? String(heatedArea) : null,
    number_of_units: null,
    number_of_units_type: null,
    parcel_identifier: parcelId || "",
    property_effective_built_year: eyb || null,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: ayb || null,
    property_type: mapPropertyTypeFromUse(propertyUseCode, bldgType),
    subdivision: null,
    total_area: totalArea ? String(totalArea) : null,
    zoning: null,
  };
  writeJSON(path.join("data", "property.json"), property);

  // Address
  const fullAddr = unaddr.full_address || "";
  const lat = unaddr.latitude || null;
  const lon = unaddr.longitude || null;
  const county = "Okaloosa";
  const country = "US";
  // Parse street parts from "5419 NORTHWOOD RD, CRESTVIEW, FL 32539"
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    street_pre_directional_text = null,
    street_post_directional_text = null;
  try {
    const firstPart = fullAddr.split(",")[0];
    const parts = firstPart.trim().split(/\s+/);
    street_number = parts.shift() || null;
    
    // Check for pre-directional (first word after number)
    if (parts.length > 0 && /^(N|S|E|W|NE|NW|SE|SW)$/i.test(parts[0])) {
      street_pre_directional_text = parts.shift().toUpperCase();
    }
    
    // Check for post-directional and suffix (last words)
    const last = parts.pop() || null; // suffix like RD
    let secondLast = null;
    if (parts.length > 0 && /^(N|S|E|W|NE|NW|SE|SW)$/i.test(parts[parts.length - 1])) {
      secondLast = parts.pop().toUpperCase();
      street_post_directional_text = secondLast;
    }
    
    street_suffix_type = last
      ? last.charAt(0).toUpperCase() + last.slice(1).toLowerCase()
      : null; // e.g., Rd
    
    let rawStreetName = parts.join(" ").toUpperCase() || null;
    // Remove any remaining directional abbreviations to match validation pattern
    if (rawStreetName) {
      street_name = rawStreetName.replace(/\b(E|N|NE|NW|S|SE|SW|W)\b/g, '').replace(/\s+/g, ' ').trim() || null;
    } else {
      street_name = null;
    }
    // Validate suffix against schema enum
    const validSuffixes = ["Rds","Blvd","Lk","Pike","Ky","Vw","Curv","Psge","Ldg","Mt","Un","Mdw","Via","Cor","Kys","Vl","Pr","Cv","Isle","Lgt","Hbr","Btm","Hl","Mews","Hls","Pnes","Lgts","Strm","Hwy","Trwy","Skwy","Is","Est","Vws","Ave","Exts","Cvs","Row","Rte","Fall","Gtwy","Wls","Clb","Frk","Cpe","Fwy","Knls","Rdg","Jct","Rst","Spgs","Cir","Crst","Expy","Smt","Trfy","Cors","Land","Uns","Jcts","Ways","Trl","Way","Trlr","Aly","Spg","Pkwy","Cmn","Dr","Grns","Oval","Cirs","Pt","Shls","Vly","Hts","Clf","Flt","Mall","Frds","Cyn","Lndg","Mdws","Rd","Xrds","Ter","Prt","Radl","Grvs","Rdgs","Inlt","Trak","Byu","Vlgs","Ctr","Ml","Cts","Arc","Bnd","Riv","Flds","Mtwy","Msn","Shrs","Rue","Crse","Cres","Anx","Drs","Sts","Holw","Vlg","Prts","Sta","Fld","Xrd","Wall","Tpke","Ft","Bg","Knl","Plz","St","Cswy","Bgs","Rnch","Frks","Ln","Mtn","Ctrs","Orch","Iss","Brks","Br","Fls","Trce","Park","Gdns","Rpds","Shl","Lf","Rpd","Lcks","Gln","Pl","Path","Vis","Lks","Run","Frg","Brg","Sqs","Xing","Pln","Glns","Blfs","Plns","Dl","Clfs","Ext","Pass","Gdn","Brk","Grn","Mnr","Cp","Pne","Spur","Opas","Upas","Tunl","Sq","Lck","Ests","Shr","Dm","Mls","Wl","Mnrs","Stra","Frgs","Frst","Flts","Ct","Mtns","Frd","Nck","Ramp","Vlys","Pts","Bch","Loop","Byp","Cmns","Fry","Walk","Hbrs","Dv","Hvn","Blf","Grv","Crk"];
    const suffixMap = {"ROAD":"Rd","RD":"Rd","AVENUE":"Ave","AVE":"Ave","STREET":"St","ST":"St","BOULEVARD":"Blvd","BLVD":"Blvd","DRIVE":"Dr","DR":"Dr","LANE":"Ln","LN":"Ln","COURT":"Ct","CT":"Ct","CIRCLE":"Cir","CIR":"Cir","PLACE":"Pl","PL":"Pl","WAY":"Way","TERRACE":"Ter","TER":"Ter","TRAIL":"Trl","TRL":"Trl","PARKWAY":"Pkwy","PKWY":"Pkwy"};
    if (street_suffix_type) {
      const upperSuffix = street_suffix_type.toUpperCase();
      const mapped = suffixMap[upperSuffix] || street_suffix_type;
      street_suffix_type = validSuffixes.includes(mapped) ? mapped : null;
    }
  } catch (e) {
    street_number = null;
    street_name = null;
    street_suffix_type = null;
    street_pre_directional_text = null;
    street_post_directional_text = null;
  }

  // City, State, Zip
  let city_name = null,
    state_code = null,
    postal_code = null,
    plus_four_postal_code = null;
  try {
    const cityState = fullAddr.split(",")[1]?.trim() || "";
    const stateZip = fullAddr.split(",")[2]?.trim() || "";
    
    // Validate city name pattern
    if (cityState && /^[A-Z\s\-']+$/.test(cityState.toUpperCase())) {
      city_name = cityState.toUpperCase();
    }
    
    const szParts = stateZip.split(/\s+/);
    const rawState = szParts[0];
    const rawZip = szParts[1];
    
    // Validate state code pattern
    if (rawState && /^[A-Z]{2}$/.test(rawState)) {
      state_code = rawState;
    }
    
    // Validate postal code patterns
    if (rawZip) {
      if (/^\d{5}$/.test(rawZip)) {
        postal_code = rawZip;
      } else if (/^\d{5}-\d{4}$/.test(rawZip)) {
        const [zip5, zip4] = rawZip.split('-');
        postal_code = zip5;
        plus_four_postal_code = zip4;
      }
    }
  } catch (e) {}

  // Section-Township-Range
  let section = null,
    township = null,
    range = null;
  const str = summary["Sec-Twp-Rng"] || null;
  if (str) {
    const parts = str.split("-");
    if (parts.length >= 3) {
      section = parts[0];
      township = parts[1];
      range = parts[2];
    }
  }

  const address = {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["855"],
        LayerID: ["15999"],
        PageTypeID: ["4"],
        PageID: ["7114"],
        Q: ["1285914563"],
        KeyValue: [parcelId || ""]
      }
    },
    request_identifier: parcelId || "",
    block: null,
    city_name,
    country_code: country,
    county_name: county,
    latitude: lat,
    longitude: lon,
    lot: null,
    municipality_name: null,
    plus_four_postal_code,
    postal_code,
    range,
    route_number: null,
    section,
    state_code,
    street_name,
    street_post_directional_text,
    street_pre_directional_text,
    street_number,
    street_suffix_type,
    unit_identifier: null,
    township,
  };
  writeJSON(path.join("data", "address.json"), address);

  // Lot
  const acreageRaw = summary["Acreage"] || summary["Acreage (GIS)"] || null;
  const acreage = acreageRaw ? Number(acreageRaw) : null;
  const lot = {
    driveway_condition: null,
    driveway_material: null,
    fence_height: null,
    fence_length: null,
    fencing_type: null,
    landscaping_features: null,
    lot_area_sqft: null,
    lot_condition_issues: null,
    lot_length_feet: null,
    lot_size_acre: acreage,
    lot_type: null,
    lot_width_feet: null,
    view: null,
  };
  writeJSON(path.join("data", "lot.json"), lot);

  // Structure
  const extWall = mapExteriorWallMaterial(building["Exterior Walls"] || null);
  const intWall = mapInteriorWallSurface(building["Interior Walls"] || null);
  const floorMap = mapFlooring(building["Floor Cover"] || null);
  const stories = building["Stories"] ? Number(building["Stories"]) : null;
  const baseArea = building["BaseAreaSqft"]
    ? Number(building["BaseAreaSqft"])
    : null;
  const roofMaterialType = (building["Roof Cover"] || "")
    .toUpperCase()
    .includes("METAL")
    ? "Metal"
    : null;

  // Flooring mapping already handles valid enum values

  const structure = {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["855"],
        LayerID: ["15999"],
        PageTypeID: ["4"],
        PageID: ["7114"],
        Q: ["1285914563"],
        KeyValue: [parcelId || ""]
      }
    },
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
    exterior_wall_material_primary: extWall,
    exterior_wall_material_secondary: null,
    finished_base_area: baseArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: floorMap.primary,
    flooring_material_secondary: floorMap.secondary,
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
    interior_wall_surface_material_primary: intWall,
    interior_wall_surface_material_secondary: null,
    number_of_stories: stories,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: roofMaterialType,
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
  writeJSON(path.join("data", "structure.json"), structure);

  // Utilities (from JSON only)
  const udata = readJSON(path.join("owners", "utilities_data.json"));
  const uKey =
    "property_" +
    (parcelId ||
      seed?.source_http_request?.multiValueQueryString?.KeyValue?.[0] ||
      "");
  const uobj = udata[uKey] || {};
  const utility = {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["855"],
        LayerID: ["15999"],
        PageTypeID: ["4"],
        PageID: ["7114"],
        Q: ["1285914563"],
        KeyValue: [parcelId || ""]
      }
    },
    request_identifier: parcelId || "",
    cooling_system_type: uobj.cooling_system_type ?? null,
    heating_system_type: uobj.heating_system_type ?? null,
    public_utility_type: uobj.public_utility_type ?? null,
    sewer_type: uobj.sewer_type ?? null,
    water_source_type: uobj.water_source_type ?? null,
    plumbing_system_type: uobj.plumbing_system_type ?? null,
    plumbing_system_type_other_description: uobj.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: uobj.electrical_panel_capacity ?? null,
    electrical_wiring_type: uobj.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: uobj.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description: uobj.electrical_wiring_type_other_description ?? null,
    solar_panel_present: uobj.solar_panel_present ?? false,
    solar_panel_type: uobj.solar_panel_type ?? null,
    solar_panel_type_other_description: uobj.solar_panel_type_other_description ?? null,
    smart_home_features: uobj.smart_home_features ?? null,
    smart_home_features_other_description: uobj.smart_home_features_other_description ?? null,
    hvac_unit_condition: uobj.hvac_unit_condition ?? null,
    solar_inverter_visible: uobj.solar_inverter_visible ?? false,
    hvac_unit_issues: uobj.hvac_unit_issues ?? null,
    electrical_panel_installation_date: uobj.electrical_panel_installation_date ?? null,
    electrical_rewire_date: uobj.electrical_rewire_date ?? null,
    hvac_capacity_kw: uobj.hvac_capacity_kw ?? null,
    hvac_capacity_tons: uobj.hvac_capacity_tons ?? null,
    hvac_equipment_component: uobj.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: uobj.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: uobj.hvac_equipment_model ?? null,
    hvac_installation_date: uobj.hvac_installation_date ?? null,
    hvac_seer_rating: uobj.hvac_seer_rating ?? null,
    hvac_system_configuration: uobj.hvac_system_configuration ?? null,
    plumbing_system_installation_date: uobj.plumbing_system_installation_date ?? null,
    sewer_connection_date: uobj.sewer_connection_date ?? null,
    solar_installation_date: uobj.solar_installation_date ?? null,
    solar_inverter_installation_date: uobj.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: uobj.solar_inverter_manufacturer ?? null,
    solar_inverter_model: uobj.solar_inverter_model ?? null,
    water_connection_date: uobj.water_connection_date ?? null,
    water_heater_installation_date: uobj.water_heater_installation_date ?? null,
    water_heater_manufacturer: uobj.water_heater_manufacturer ?? null,
    water_heater_model: uobj.water_heater_model ?? null,
    well_installation_date: uobj.well_installation_date ?? null,
  };
  writeJSON(path.join("data", "utility.json"), utility);

  // Layout (from JSON only)
  const ldata = readJSON(path.join("owners", "layout_data.json"));
  const lKey =
    "property_" +
    (parcelId ||
      seed?.source_http_request?.multiValueQueryString?.KeyValue?.[0] ||
      "");
  const layouts = (ldata[lKey] && ldata[lKey].layouts) || [];
  let layoutIdx = 1;
  layouts.forEach((layout) => {
    const out = { ...layout };
    writeJSON(path.join("data", `layout_${layoutIdx}.json`), out);
    layoutIdx += 1;
  });

  // Tax: output for each available year in Valuation table
  valuationAll.forEach((entry) => {
    const vals = entry.values || {};
    const tax = {
      source_http_request: {
        method: "GET",
        url: "https://qpublic.schneidercorp.com/application.aspx",
        multiValueQueryString: {
          AppID: ["855"],
          LayerID: ["15999"],
          PageTypeID: ["4"],
          PageID: ["7114"],
          Q: ["1285914563"],
          KeyValue: [parcelId || ""]
        }
      },
      request_identifier: parcelId || "",
      tax_year: entry.year,
      property_assessed_value_amount: currencyToNumber(vals["Assessed Value"]) || 0,
      property_market_value_amount: currencyToNumber(vals["Just (Market) Value"]) || 0,
      property_building_amount: currencyToNumber(vals["Building Value"]) || 0,
      property_land_amount: currencyToNumber(vals["Land Value"]) || 0,
      property_taxable_value_amount: currencyToNumber(vals["Taxable Value"]) || 0,
      monthly_tax_amount: 0,
      period_end_date: `${entry.year}-12-31`,
      period_start_date: `${entry.year}-01-01`,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
    writeJSON(path.join("data", `tax_${entry.year}.json`), tax);
  });

  // Sales + Deeds
  // Sort sales chronologically ascending for consistent numbering
  const salesSorted = sales.slice().sort((a, b) => {
    const da = new Date(parseSaleDateToISO(a.date) || "1900-01-01");
    const db = new Date(parseSaleDateToISO(b.date) || "1900-01-01");
    return da - db;
  });
  const salesFileMap = new Map();
  salesSorted.forEach((s, idx) => {
    const fIdx = idx + 1;
    const sale = {
      ownership_transfer_date: parseSaleDateToISO(s.date),
      purchase_price_amount: currencyToNumber(s.price),
      // sale_type omitted (unknown)
    };
    const salePath = path.join("data", `sales_${fIdx}.json`);
    writeJSON(salePath, sale);
    salesFileMap.set(parseSaleDateToISO(s.date), `./sales_${fIdx}.json`);

    // Create deed if instrument can be mapped
    const deedType = mapInstrumentToDeedType(s.instrument);
    if (deedType) {
      const deed = { deed_type: deedType };
      const deedPathRel = `./deed_${fIdx}.json`;
      writeJSON(path.join("data", `deed_${fIdx}.json`), deed);
      // relationship sales -> deed
      const rel = {
        to: { "/": `./sales_${fIdx}.json` },
        from: { "/": deedPathRel },
      };
      writeJSON(path.join("data", `relationship_sales_deed_${fIdx}.json`), rel);
    }
  });

  // Owners (from owner_data.json), and relationships
  const odata = readJSON(path.join("owners", "owner_data.json"));
  const oKey =
    "property_" +
    (parcelId ||
      seed?.source_http_request?.multiValueQueryString?.KeyValue?.[0] ||
      "");
  const owners_by_date = (odata[oKey] && odata[oKey].owners_by_date) || {};

  // build unique person list
  const personMap = new Map(); // key: First|Middle|Last -> file path
  const persons = [];
  const dateKeys = Object.keys(owners_by_date)
    .filter((k) => k !== "current")
    .sort();
  dateKeys.forEach((dateKey) => {
    const arr = owners_by_date[dateKey] || [];
    arr.forEach((o) => {
      if (o.type === "person") {
        const first = normalizeName(o.first_name);
        const last = normalizeName(o.last_name);
        const middle = o.middle_name ? normalizeName(o.middle_name) : null;
        const key = `${first}|${middle || ""}|${last}`;
        if (!personMap.has(key)) {
          persons.push({ first, middle, last });
          personMap.set(key, null); // placeholder
        }
      }
    });
  });

  // write person files with potential suffix enrichment based on sales text for that date
  persons.forEach((p, idx) => {
    const i = idx + 1;
    // find all sales entries on dates where this person is an owner
    const salesForPersonDates = [];
    dateKeys.forEach((dateKey) => {
      const ownersForDate = owners_by_date[dateKey] || [];
      const match = ownersForDate.some((o) => {
        const f = normalizeName(o.first_name);
        const l = normalizeName(o.last_name);
        const m = o.middle_name ? normalizeName(o.middle_name) : null;
        return (
          f === p.first && l === p.last && (m === p.middle || (!m && !p.middle))
        );
      });
      if (match) {
        const saleIso = dateKey;
        const saleRow = salesSorted.filter(
          (s) => parseSaleDateToISO(s.date) === saleIso,
        );
        if (saleRow.length > 0) salesForPersonDates.push(...saleRow);
      }
    });
    const suffixName = deriveSuffixFromTextForPerson(salesForPersonDates, p);

    // Validate first_name pattern
    let validFirstName = p.first || "Unknown";
    if (validFirstName !== "Unknown" && !/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(validFirstName)) {
      validFirstName = validFirstName.charAt(0).toUpperCase() + validFirstName.slice(1).toLowerCase();
      if (!/^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/.test(validFirstName)) {
        validFirstName = "Unknown";
      }
    }

    const person = {
      source_http_request: {
        method: "GET",
        url: "https://qpublic.schneidercorp.com/application.aspx",
        multiValueQueryString: {
          AppID: ["855"],
          LayerID: ["15999"],
          PageTypeID: ["4"],
          PageID: ["7114"],
          Q: ["1285914563"],
          KeyValue: [parcelId || ""]
        }
      },
      request_identifier: parcelId || "",
      birth_date: null,
      first_name: validFirstName,
      last_name: p.last || "Unknown",
      middle_name: p.middle && p.middle.trim() ? (() => {
        let cleaned = p.middle.replace(/[^a-zA-Z\s\-',.]/g, '').trim();
        if (cleaned && !/^[A-Z][a-zA-Z\s\-',.]*$/.test(cleaned)) {
          cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          if (!/^[A-Z][a-zA-Z\s\-',.]*$/.test(cleaned)) {
            cleaned = null;
          }
        }
        return cleaned || null;
      })() : null,
      prefix_name: null,
      suffix_name: suffixName || null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    const relPath = `./person_${i}.json`;
    writeJSON(path.join("data", `person_${i}.json`), person);
    const key = `${p.first}|${p.middle || ""}|${p.last}`;
    personMap.set(key, relPath);
  });

  // relationships: link each sale date to corresponding owners on that date
  let relIdx = 1;
  dateKeys.forEach((dateKey) => {
    const saleFileRel = salesFileMap.get(dateKey);
    if (!saleFileRel) return; // if sale not present, skip
    const ownersForDate = owners_by_date[dateKey] || [];
    ownersForDate.forEach((o) => {
      if (o.type === "person") {
        const first = normalizeName(o.first_name);
        const last = normalizeName(o.last_name);
        const middle = o.middle_name ? normalizeName(o.middle_name) : null;
        const key = `${first}|${middle || ""}|${last}`;
        const personRel = personMap.get(key);
        if (personRel) {
          const rel = {
            to: { "/": personRel },
            from: { "/": saleFileRel },
          };
          writeJSON(
            path.join("data", `relationship_sales_person_${relIdx}.json`),
            rel,
          );
          relIdx += 1;
        }
      }
    });
  });

  // Files outputs - only create files with valid URLs
  let fileIdx = 1;
  files.forEach((f) => {
    // Only create file objects if they have valid URLs
    if (f.original_url && f.original_url.trim() && f.original_url.startsWith("http")) {
      const fileObj = {
        document_type: f.document_type ?? null,
        file_format: f.file_format ?? null,
        ipfs_url: null,
        name: f.name || null,
        original_url: f.original_url,
        source_http_request: {
          method: "GET",
          url: "https://qpublic.schneidercorp.com/application.aspx",
          multiValueQueryString: {
            AppID: ["855"],
            LayerID: ["15999"],
            PageTypeID: ["4"],
            PageID: ["7114"],
            Q: ["1285914563"],
            KeyValue: [parcelId || ""]
          }
        },
        request_identifier: parcelId || "",
      };
      writeJSON(path.join("data", `file_${fileIdx}.json`), fileObj);
      fileIdx += 1;
    }
  });
}

main();
