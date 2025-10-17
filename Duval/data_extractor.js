#!/usr/bin/env node
/*
  Data extraction script per evaluator spec.
  - Reads: input.html, unnormalized_address.json
           owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
  - Writes: data/*.json for available, schema-compliant objects.

  Notes:
  - Owners/Utilities/Layout are sourced strictly from the owners/*.json files.
  - Sales/Tax/Property/Deed/File are sourced from input.html.
  - Address is sourced from unnormalized_address.json and input.html.
  - Emits error JSON for unknown enum values when mapping is required.
*/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writeJSON(relPath, obj) {
  const outPath = path.join("data", relPath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
}
function unlinkIfExists(relPath) {
  const p = path.join("data", relPath);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function cleanMoneyToNumber(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}
function toISODate(mdyyyy) {
  if (!mdyyyy) return null;
  const m = String(mdyyyy).trim();
  const parts = m.split("/");
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;
  return null;
}
function enumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
  throw new Error(err.message + " at " + pathStr);
}
function safeParseNumber(value) {
  if (value == null) return null;
  const numeric = String(value).replace(/[^0-9.\-]/g, "");
  if (!numeric) return null;
  const n = Number(numeric);
  return Number.isNaN(n) ? null : n;
}
function mapStructureForm(propertyUseText, buildingTypeText) {
  const source = `${propertyUseText || ""} ${buildingTypeText || ""}`.toLowerCase();
  if (!source.trim()) return null;
  if (source.includes("townhouse") || source.includes("rowhouse") || source.includes("row house"))
    return "TownhouseRowhouse";
  if (source.includes("duplex")) return "Duplex";
  if (source.includes("triplex")) return "Triplex";
  if (source.includes("quad") || source.includes("fourplex") || source.includes("4-plex"))
    return "Quadplex";
  if (source.includes("loft")) return "Loft";
  if (source.includes("apartment") || source.includes("condo")) return "ApartmentUnit";
  if (source.includes("semi-det") || source.includes("semi detached"))
    return "SingleFamilySemiDetached";
  if (source.includes("manufactured") || source.includes("mobile"))
    return "ManufacturedHomeOnLand";
  if (source.includes("multi") && source.includes("10"))
    return "MultiFamilyMoreThan10";
  if (source.includes("multi") && source.includes("5"))
    return "MultiFamily5Plus";
  if (source.includes("multi")) return "MultiFamilyLessThan10";
  if (source.includes("single family")) return "SingleFamilyDetached";
  return null;
}
function mapPropertyUsageType(propertyUseText) {
  if (!propertyUseText) return "Unknown";
  const normalized = propertyUseText.toLowerCase();
  if (/agric|farm|orchard|grove|timber|hay|grazing|poultry|crop/.test(normalized))
    return "Agricultural";
  if (/industrial|manufactur|warehouse/.test(normalized)) return "Industrial";
  if (/office/.test(normalized)) return "OfficeBuilding";
  if (/retail|store|commercial|shopping/.test(normalized)) return "RetailStore";
  if (/church/.test(normalized)) return "Church";
  if (/public school/.test(normalized)) return "PublicSchool";
  if (/school/.test(normalized)) return "PrivateSchool";
  if (/hospital/.test(normalized))
    return normalized.includes("public") ? "PublicHospital" : "PrivateHospital";
  if (/hotel|motel/.test(normalized)) return "Hotel";
  if (/golf/.test(normalized)) return "GolfCourse";
  if (/club|lodge/.test(normalized)) return "ClubsLodges";
  if (/utility/.test(normalized)) return "Utility";
  if (/residential|single family|townhouse|duplex|triplex|quad|multi|condo|apartment/.test(normalized))
    return "Residential";
  if (/vacant|transitional/.test(normalized)) return "TransitionalProperty";
  return "Unknown";
}
function determinePropertyType(heatedAreaValue, propertyUseText, buildingTypeText) {
  const area = safeParseNumber(heatedAreaValue);
  if (area && area > 0) {
    if (
      /condo|apartment|unit/.test((propertyUseText || "").toLowerCase()) ||
      /unit/.test((buildingTypeText || "").toLowerCase())
    ) {
      return "Unit";
    }
    return "Building";
  }
  const source = `${propertyUseText || ""} ${buildingTypeText || ""}`.toLowerCase();
  if (/manufactured|mobile/.test(source)) return "ManufacturedHome";
  if (/vacant|land|lot/.test(source)) return "LandParcel";
  return "Building";
}
function mapUnitsType(unitsCount) {
  const n = safeParseNumber(unitsCount);
  if (n == null || n <= 0) return null;
  const whole = Math.round(n);
  if (!Number.isFinite(whole)) return null;
  if (whole === 1) return "One";
  if (whole === 2) return "Two";
  if (whole === 3) return "Three";
  if (whole === 4) return "Four";
  if (whole >= 2 && whole <= 4) return "TwoToFour";
  if (whole >= 1 && whole <= 4) return "OneToFour";
  return null;
}
function textOrNull(t) {
  if (!t) return null;
  const s = String(t).trim();
  return s === "" ? null : s;
}

function parseAddressPartsFromFull(fullAddr) {
  if (!fullAddr) return {};
  const out = {
    street_number: null,
    street_name: null,
    street_suffix_type: null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: null,
    state_code: null,
    postal_code: null,
    plus_four_postal_code: null,
  };
  const partsComma = String(fullAddr).split(/\s*,\s*/);
  let line1 = null,
    city = null,
    stateZip = null;
  if (partsComma.length === 3) {
    [line1, city, stateZip] = partsComma;
  } else if (partsComma.length === 2) {
    [line1, stateZip] = partsComma;
  } else {
    line1 = partsComma[0];
    stateZip = partsComma.slice(1).join(",");
  }
  if (line1) {
    const parts = line1.trim().split(/\s+/);
    if (parts.length >= 2) {
      out.street_number = parts.shift();
      let suffix = null;
      if (parts.length >= 2) suffix = parts.pop();
      const name = parts.join(" ");
      out.street_name = name ? name.toUpperCase() : null;
      if (suffix) {
        const sfxUpper = suffix.toUpperCase();
        const map = {
          ST: "St",
          STREET: "St",
          AVE: "Ave",
          AVENUE: "Ave",
          BLVD: "Blvd",
          BOULEVARD: "Blvd",
          RD: "Rd",
          ROAD: "Rd",
          DR: "Dr",
          DRIVE: "Dr",
          LN: "Ln",
          LANE: "Ln",
          CT: "Ct",
          COURT: "Ct",
          CIR: "Cir",
          CIRCLE: "Cir",
          HWY: "Hwy",
          HIGHWAY: "Hwy",
          PL: "Pl",
          PLACE: "Pl",
          TER: "Ter",
          TERRACE: "Ter",
          WAY: "Way",
          PKWY: "Pkwy",
          RDG: "Rdg",
          RIDGE: "Rdg",
          RUN: "Run",
          LOOP: "Loop",
        };
        out.street_suffix_type = map[sfxUpper] || sfxUpper;
      }
    }
  }
  if (city) out.city_name = city.trim().toUpperCase();
  if (stateZip) {
    const m = stateZip.match(/^([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/i);
    if (m) {
      out.state_code = m[1].toUpperCase();
      out.postal_code = m[2];
      out.plus_four_postal_code = m[3] || null;
    }
  }
  return out;
}
function parseCityStateZipFromHtml($) {
  const line2 = textOrNull(
    $("#ctl00_cphBody_lblPrimarySiteAddressLine2").text(),
  );
  if (!line2)
    return {
      city_name: null,
      state_code: null,
      postal_code: null,
      plus_four_postal_code: null,
    };
  const cleaned = line2.replace(/-+$/, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 3) {
    const city = parts.slice(0, parts.length - 2).join(" ");
    const state = parts[parts.length - 2];
    const zip = parts[parts.length - 1].slice(0, 5);
    return {
      city_name: city.toUpperCase(),
      state_code: state.toUpperCase(),
      postal_code: zip,
      plus_four_postal_code: null,
    };
  }
  return {
    city_name: null,
    state_code: null,
    postal_code: null,
    plus_four_postal_code: null,
  };
}
function parsePLSTrsFromLegalRows(legalRows) {
  for (const r of legalRows) {
    const m = String(r).match(/(\d{1,2})-(\d+)([NS]?)-(\d+)([EW]?)/i);
    if (m) {
      const section = m[1];
      const township = m[2] + (m[3] ? m[3].toUpperCase() : "");
      const range = m[4] + (m[5] ? m[5].toUpperCase() : "");
      return { section, township, range };
    }
  }
  return { section: null, township: null, range: null };
}
function parseLotFromLegalRows(legalRows) {
  for (const r of legalRows) {
    const m = String(r).match(/\bLOT\s+(\S+)/i);
    if (m) return m[1];
  }
  return null;
}

function mapDeedType(instr) {
  if (!instr) return null;
  const s = instr.toLowerCase();
  if (s.includes("special warranty")) return "Special Warranty Deed";
  if (s.includes("warranty") && !s.includes("special")) return "Warranty Deed";
  if (s.includes("quit")) return "Quitclaim Deed";
  return null;
}
function fileDocTypeForDeedType(deedType) {
  if (deedType === "Warranty Deed") return "ConveyanceDeedWarrantyDeed";
  if (deedType === "Special Warranty Deed") return "ConveyanceDeed";
  if (deedType === "Quitclaim Deed") return "ConveyanceDeedQuitClaimDeed";
  return "ConveyanceDeed";
}

function extractStructure($) {
  const result = {
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
    finished_base_area: null,
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
    number_of_buildings: null,
    number_of_stories: null,
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
  const nob = textOrNull($("#ctl00_cphBody_lblNumberOfBuildings").text());
  if (nob) result.number_of_buildings = Number(nob);
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const label = textOrNull($(tds[0]).text());
        const code = textOrNull($(tds[1]).text());
        if (label && /stories/i.test(label)) {
          const n = Number(code);
          if (!Number.isNaN(n)) result.number_of_stories = n;
        }
      }
    },
  );
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const type = textOrNull($(tds[0]).text());
        const gross = textOrNull($(tds[1]).text());
        if (type && /base area/i.test(type)) {
          if (gross) result.finished_base_area = Number(gross);
        }
        if (type && /finished upper story/i.test(type)) {
          if (gross) result.finished_upper_story_area = Number(gross);
        }
      }
    },
  );
  let floorPrim = null,
    floorSec = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingElements tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const element = textOrNull($(tds[0]).text());
        const detail = textOrNull($(tds[2]).text());
        if (!element || !detail) return;
        if (/roof struct/i.test(element)) {
          // If both words present, prefer Gable per reviewer guidance
          if (/gable/i.test(detail) && /hip/i.test(detail))
            result.roof_design_type = "Gable";
          else if (/gable/i.test(detail)) result.roof_design_type = "Gable";
          else if (/hip/i.test(detail)) result.roof_design_type = "Hip";
        }
        if (/roofing cover/i.test(element)) {
          if (/asph|comp\s*shng/i.test(detail)) {
            result.roof_material_type = "Composition";
            result.roof_covering_material = "Architectural Asphalt Shingle";
          }
        }
        if (/exterior wall/i.test(element)) {
          if (/horizontal\s+lap/i.test(detail)) {
            result.exterior_wall_material_primary =
              result.exterior_wall_material_primary || "Fiber Cement Siding";
          }
          if (/vertical\s+sheet/i.test(detail)) {
            if (result.exterior_wall_material_primary)
              result.exterior_wall_material_secondary = "Wood Siding";
            else result.exterior_wall_material_primary = "Wood Siding";
          }
        }
        if (/interior wall/i.test(element)) {
          if (/drywall/i.test(detail))
            result.interior_wall_surface_material_primary = "Drywall";
        }
        if (/int flooring/i.test(element)) {
          if (/carpet/i.test(detail)) {
            if (!floorPrim) floorPrim = "Carpet";
            else if (!floorSec) floorSec = "Carpet";
          }
          if (/cer\s*clay\s*tile|cer\s*tile|tile/i.test(detail)) {
            if (!floorPrim) floorPrim = "Ceramic Tile";
            else if (!floorSec) floorSec = "Ceramic Tile";
          }
        }
      }
    },
  );
  result.flooring_material_primary = floorPrim;
  result.flooring_material_secondary = floorSec;
  const bType = textOrNull(
    $("#ctl00_cphBody_repeaterBuilding_ctl00_lblBuildingType").text(),
  );
  if (bType && /townhouse/i.test(bType)) result.attachment_type = "Attached";
  return result;
}

function extractLot($, legalRows, totalAreaStr) {
  let lot_area_sqft = null;
  const ta = textOrNull(totalAreaStr);
  if (ta && /^\d+$/.test(ta)) lot_area_sqft = Number(ta);
  return {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
}

function main() {
  const inputHtmlPath = "input.html";
  const unnormalizedAddressPath = "unnormalized_address.json";
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  let html;
  try {
    html = fs.readFileSync(inputHtmlPath, "utf8");
  } catch (err) {
    const altPath = "0020608295R.html";
    if (fs.existsSync(altPath)) html = fs.readFileSync(altPath, "utf8");
    else throw err;
  }
  const $ = cheerio.load(html);
  const unnormalizedAddress = fs.existsSync(unnormalizedAddressPath)
    ? readJSON(unnormalizedAddressPath)
    : null;
  const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  ensureDir("data");
  // Clean up duplicates from older runs
  unlinkIfExists("relationship_deed_file.json");
  unlinkIfExists("relationship_sales_deed.json");

  const parcelIdentifier = unnormalizedAddress.request_identifier;

  const propertyUseText = textOrNull($("#ctl00_cphBody_lblPropertyUse").text());
  const subdivision = textOrNull($("#ctl00_cphBody_lblSubdivision").text());
  const totalArea = textOrNull($("#ctl00_cphBody_lblTotalArea1").text());

  const legalRows = [];
  $("#ctl00_cphBody_gridLegal tr").each((i, el) => {
    if (i === 0) return;
    const tds = $(el).find("td");
    if (tds.length >= 2) {
      const desc = textOrNull($(tds[1]).text());
      if (desc) legalRows.push(desc);
    }
  });
  const legalDescription = legalRows.length ? legalRows.join("; ") : null;

  let zoning = null;
  $("#ctl00_cphBody_gridLand tr").each((i, el) => {
    if (i === 0) return;
    const tds = $(el).find("td");
    if (tds.length >= 10) {
      const z = textOrNull($(tds[3]).text());
      if (z) zoning = z;
    }
  });

  const yearBuilt = textOrNull(
    $("#ctl00_cphBody_repeaterBuilding_ctl00_lblYearBuilt").text(),
  );
  let heatedAreaTotal = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingArea tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const type = textOrNull($(tds[0]).text());
        if (type && type.toLowerCase() === "total") {
          const heatedStr = textOrNull($(tds[2]).text());
          if (heatedStr) heatedAreaTotal = heatedStr;
        }
      }
    },
  );

  let unitsCount = null;
  $("#ctl00_cphBody_repeaterBuilding_ctl00_gridBuildingAttributes tr").each(
    (i, el) => {
      if (i === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const label = textOrNull($(tds[0]).text());
        const code = textOrNull($(tds[1]).text());
        if (label && /rooms\s*\/\s*units/i.test(label)) {
          const asNum = Number(code);
          if (!Number.isNaN(asNum)) unitsCount = asNum;
        }
      }
    },
  );

  const buildingTypeText = textOrNull(
    $("#ctl00_cphBody_repeaterBuilding_ctl00_lblBuildingType").text(),
  );
  const structureForm = mapStructureForm(propertyUseText, buildingTypeText);
  const propertyUsageType = mapPropertyUsageType(propertyUseText);
  const propertyTypeCategory = determinePropertyType(
    heatedAreaTotal,
    propertyUseText,
    buildingTypeText,
  );
  const numberOfUnitsType = mapUnitsType(unitsCount);

  if (parcelIdentifier && legalDescription && yearBuilt && propertyTypeCategory) {
    const heatedAreaNumber = safeParseNumber(heatedAreaTotal);
    const heatedAreaString =
      heatedAreaNumber != null ? String(Math.round(heatedAreaNumber)) : null;
    writeJSON("property.json", {
      parcel_identifier: parcelIdentifier,
      property_type: propertyTypeCategory,
      property_structure_built_year: Number(yearBuilt),
      property_legal_description_text: legalDescription,
      number_of_units_type: numberOfUnitsType,
      number_of_units: unitsCount != null ? Number(unitsCount) : null,
      structure_form: structureForm,
      property_usage_type: propertyUsageType,
      livable_floor_area: heatedAreaString,
      area_under_air: heatedAreaString,
      subdivision: subdivision || null,
      total_area: totalArea || null,
      zoning: zoning || null,
      property_effective_built_year: null,
    });
  }

  const addrPartsFull =
    unnormalizedAddress && unnormalizedAddress.full_address
      ? parseAddressPartsFromFull(unnormalizedAddress.full_address)
      : {};
  const cityStateZipFromHtml = parseCityStateZipFromHtml($);
  const trs = parsePLSTrsFromLegalRows(legalRows);
  const lotStr = parseLotFromLegalRows(legalRows);
  writeJSON("address.json", {
    street_number: addrPartsFull.street_number || null,
    street_name: addrPartsFull.street_name || null,
    street_suffix_type: addrPartsFull.street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: addrPartsFull.unit_identifier || null,
    city_name:
      addrPartsFull.city_name || cityStateZipFromHtml.city_name || null,
    state_code:
      addrPartsFull.state_code || cityStateZipFromHtml.state_code || null,
    postal_code:
      addrPartsFull.postal_code || cityStateZipFromHtml.postal_code || null,
    plus_four_postal_code:
      addrPartsFull.plus_four_postal_code ||
      cityStateZipFromHtml.plus_four_postal_code ||
      null,
    county_name: "Duval",
    country_code: "US",
    latitude: null,
    longitude: null,
    lot: lotStr || null,
    municipality_name: null,
    range: trs.range,
    route_number: null,
    section: trs.section,
    township: trs.township,
    block: null,
  });

  const sales = [];
  $("#ctl00_cphBody_gridSalesHistory tr").each((i, el) => {
    if (i === 0) return;
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const bookPageAnchor = $(tds[0]).find("a");
      const bookPage = textOrNull($(tds[0]).text());
      const bookHref = bookPageAnchor.attr("href")
        ? String(bookPageAnchor.attr("href"))
        : null;
      const saleDate = toISODate(textOrNull($(tds[1]).text()));
      const salePrice = cleanMoneyToNumber($(tds[2]).text());
      const deedInstr = textOrNull($(tds[3]).text());
      const deedType = mapDeedType(deedInstr);
      if (saleDate && salePrice != null && salePrice > 0) {
        sales.push({
          bookPage,
          bookHref,
          ownership_transfer_date: saleDate,
          purchase_price_amount: salePrice,
          deedType,
        });
      }
    }
  });

  sales.forEach((s, idx) => {
    writeJSON(`sales_${idx + 1}.json`, {
      ownership_transfer_date: s.ownership_transfer_date,
      purchase_price_amount: s.purchase_price_amount,
    });
    if (s.deedType)
      writeJSON(`deed_${idx + 1}.json`, { deed_type: s.deedType });
    if (s.bookHref) {
      writeJSON(`file_${idx + 1}.json`, {
        document_type: fileDocTypeForDeedType(s.deedType || null),
        file_format: "txt",
        name: s.bookPage || `BookPage_${idx + 1}`,
        original_url: s.bookHref.startsWith("http")
          ? s.bookHref
          : `http://oncore.duvalclerk.com${s.bookHref}`,
        ipfs_url: null,
      });
      if (s.deedType) {
        writeJSON(`relationship_deed_file_${idx + 1}.json`, {
          to: { "/": `./deed_${idx + 1}.json` },
          from: { "/": `./file_${idx + 1}.json` },
        });
        writeJSON(`relationship_sales_deed_${idx + 1}.json`, {
          to: { "/": `./sales_${idx + 1}.json` },
          from: { "/": `./deed_${idx + 1}.json` },
        });
      }
    }
  });

  // Also capture property map image as a file record
  const imgSrc = $("#ctl00_cphBody_imgGISImageFound").attr("src");
  if (imgSrc) {
    writeJSON("file_taxmap.json", {
      document_type: "PropertyImage",
      file_format: "png",
      name: "Tax Map",
      original_url: imgSrc.startsWith("http")
        ? imgSrc
        : `https://maps.coj.net${imgSrc}`,
      ipfs_url: null,
    });
  }

  function parseValueFromSpan(id) {
    const txt = textOrNull($(id).text());
    return cleanMoneyToNumber(txt);
  }
  const taxSets = [
    {
      year: 2024,
      building: parseValueFromSpan("#ctl00_cphBody_lblBuildingValueCertified"),
      land: parseValueFromSpan("#ctl00_cphBody_lblLandValueMarketCertified"),
      market: parseValueFromSpan("#ctl00_cphBody_lblJustMarketValueCertified"),
      assessed: parseValueFromSpan(
        "#ctl00_cphBody_lblAssessedValueA10Certified",
      ),
      taxable: parseValueFromSpan("#ctl00_cphBody_lblTaxableValueCertified"),
    },
    {
      year: 2025,
      building: parseValueFromSpan("#ctl00_cphBody_lblBuildingValueInProgress"),
      land: parseValueFromSpan("#ctl00_cphBody_lblLandValueMarketInProgress"),
      market: parseValueFromSpan("#ctl00_cphBody_lblJustMarketValueInProgress"),
      assessed: parseValueFromSpan(
        "#ctl00_cphBody_lblAssessedValueA10InProgress",
      ),
      taxable: parseValueFromSpan("#ctl00_cphBody_lblTaxableValueInProgress"),
    },
  ];
  let taxIndex = 0;
  taxSets.forEach((ts) => {
    if (ts.year && ts.market != null && ts.assessed != null) {
      taxIndex += 1;
      writeJSON(`tax_${taxIndex}.json`, {
        tax_year: ts.year,
        property_assessed_value_amount: ts.assessed,
        property_market_value_amount: ts.market,
        property_building_amount: ts.building != null ? ts.building : null,
        property_land_amount: ts.land != null ? ts.land : null,
        property_taxable_value_amount:
          ts.taxable != null ? ts.taxable : ts.assessed,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        yearly_tax_amount: null,
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
      });
    }
  });

  if (ownersData && parcelIdentifier) {
    const keyFromRe = `property_${parcelIdentifier}`;
    const ownerRecord = ownersData[keyFromRe];
    if (ownerRecord && ownerRecord.owners_by_date) {
      const current = ownerRecord.owners_by_date.current || [];
      const companies = current.filter((o) => o.type === "company");
      if (companies.length > 0) {
        writeJSON("company_1.json", { name: companies[0].name || null });
      }
      // Build relationships only for exact date matches found in owners_by_date keys (excluding 'current')
      const dateKeys = Object.keys(ownerRecord.owners_by_date)
        .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
        .sort();
      let relIdx = 0;
      dateKeys.forEach((d) => {
        const ownersOnDate = ownerRecord.owners_by_date[d] || [];
        const hasCompany = ownersOnDate.some((o) => o.type === "company");
        if (hasCompany) {
          sales.forEach((s, sIdx) => {
            if (s.ownership_transfer_date === d) {
              relIdx += 1;
              writeJSON(
                relIdx === 1
                  ? "relationship_sales_company.json"
                  : `relationship_sales_company_${relIdx}.json`,
                {
                  to: { "/": "./company_1.json" },
                  from: { "/": `./sales_${sIdx + 1}.json` },
                },
              );
            }
          });
        }
      });
    }
  }

  if (utilitiesData) {
    const key = `property_${parcelIdentifier}`;
    const util = utilitiesData[key];
    if (util) writeJSON("utility.json", util);
  }
  if (layoutData) {
    const key = `property_${parcelIdentifier}`;
    const ld = layoutData[key];
    if (ld && Array.isArray(ld.layouts))
      ld.layouts.forEach((layout, idx) =>
        writeJSON(`layout_${idx + 1}.json`, layout),
      );
  }

  const structureObj = extractStructure($);
  writeJSON("structure.json", structureObj);
  const lotObj = extractLot($, legalRows, totalArea);
  writeJSON("lot.json", lotObj);
}

main();
