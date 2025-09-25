const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const cleaned = String(txt).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Number(Math.round(n * 100) / 100) : null;
}

function parseMDYToISO(d) {
  if (!d) return null;
  const m = String(d).trim();
  const parts = m.split("/");
  if (parts.length !== 3) return null;
  let [mm, dd, yyyy] = parts.map((p) => p.trim());
  if (yyyy.length === 2) yyyy = (Number(yyyy) < 50 ? "20" : "19") + yyyy; // fallback
  mm = mm.padStart(2, "0");
  dd = dd.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapDeedTypeFromInstrument(instr) {
  if (!instr) return null;
  const s = instr.trim().toUpperCase();
  if (s === "QC") return "Quitclaim Deed";
  if (s === "SW" || s === "SWD" || s === "S/W") return "Special Warranty Deed";
  if (s === "WD") return "Warranty Deed";
  throw {
    type: "error",
    message: `Unknown enum value ${instr}.`,
    path: "deed.deed_type",
  };
}

function mapPropertyType(summaryUseText) {
  if (!summaryUseText) return null;
  const t = summaryUseText.toUpperCase();
  if (t.includes("MULTI") && (t.includes("10 MORE") || t.includes("16-39")))
    return "MultiFamilyMoreThan10";
  if (t.includes("APARTMENT")) return "Apartment";
  throw {
    type: "error",
    message: `Unknown enum value ${summaryUseText}.`,
    path: "property.property_type",
  };
}

function normalizeCompanyName(name) {
  if (!name) return "";
  let s = name.toUpperCase();
  s = s.replace(
    /\b(LIMITED|LTD\.?|LLC\.?|L\.L\.C\.|INC\.?|INCORPORATED|CO\.?|COMPANY|CORP\.?|CORPORATION|LP\.?|LLP\.?|LLLP\.?)\b/g,
    "",
  );
  s = s.replace(/[^A-Z0-9]+/g, " ").trim();
  return s;
}

function bestCompanyMatch(granteeRaw, companyIndexByName) {
  const raw = (granteeRaw || "").trim();
  if (!raw) return null;
  const rawUpper = raw.toUpperCase();
  const normRaw = normalizeCompanyName(raw);
  let best = null;
  for (const [compName, idx] of companyIndexByName.entries()) {
    const compUpper = compName.toUpperCase();
    const normComp = normalizeCompanyName(compName);
    let score = 0;
    if (rawUpper === compUpper) score = 100;
    else if (normRaw && normComp && normRaw === normComp) score = 90;
    else if (
      normRaw &&
      normComp &&
      (normRaw.includes(normComp) || normComp.includes(normRaw))
    )
      score = 50;
    else if (
      rawUpper &&
      compUpper &&
      (rawUpper.includes(compUpper) || compUpper.includes(rawUpper))
    )
      score = 40;

    if (score > 0) {
      if (!best) {
        best = { idx, compName, score, length: compName.length };
      } else {
        if (
          score > best.score ||
          (score === best.score && compName.length < best.length)
        ) {
          best = { idx, compName, score, length: compName.length };
        }
      }
    }
  }
  return best ? best.idx : null;
}

function main() {
  const baseDir = process.cwd();
  const inputHtmlPath = path.join(baseDir, "input.html");
  const addressPath = path.join(baseDir, "unnormalized_address.json");
  const seedPath = path.join(baseDir, "property_seed.json");
  const ownersDir = path.join(baseDir, "owners");
  const ownerDataPath = path.join(ownersDir, "owner_data.json");
  const utilitiesDataPath = path.join(ownersDir, "utilities_data.json");
  const layoutDataPath = path.join(ownersDir, "layout_data.json");
  const outDir = path.join(baseDir, "data");
  ensureDir(outDir);

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(addressPath);
  const seed = readJSON(seedPath);
  const ownerDataAll = readJSON(ownerDataPath);
  let utilitiesData = null;
  try {
    utilitiesData = readJSON(utilitiesDataPath);
  } catch {}
  let layoutData = null;
  try {
    layoutData = readJSON(layoutDataPath);
  } catch {}

  const parcelId =
    (seed && (seed.parcel_id || seed.request_identifier)) ||
    (unAddr && unAddr.request_identifier) ||
    "";
  const propertyKey = `property_${parcelId}`;

  const parcelSummary = {};
  $(
    "#ctlBodyPane_ctl01_ctl01_dynamicSummary_divSummary table.tabular-data-two-column tbody tr",
  ).each((i, el) => {
    const key = $(el).find("th").text().trim();
    const val = $(el).find("td").text().replace(/\s+/g, " ").trim();
    parcelSummary[key] = val;
  });

  let property_type_value = null;
  try {
    property_type_value = mapPropertyType(
      parcelSummary["Property Use Code"] || "",
    );
  } catch (e) {
    if (e && e.type === "error") {
      console.error(JSON.stringify(e));
      process.exit(1);
    } else throw e;
  }

  let legalDesc = null;
  $(
    "#ctlBodyPane_ctl01_ctl01_dynamicSummary_divSummary table.tabular-data-two-column tbody tr",
  ).each((i, tr) => {
    const k = $(tr).find("th").text().trim();
    if (k === "Brief Tax Description") {
      const descSpan = $(tr)
        .find("td span")
        .filter((j, sp) => !$(sp).hasClass("important-note"))
        .first();
      legalDesc = descSpan.text().replace(/\s+/g, " ").trim() || null;
    }
  });

  let firstHeatedArea = null,
    firstTotalArea = null,
    firstActualYearBuilt = null;
  const buildingLeftSel =
    "div[id^='ctlBodyPane_ctl04_ctl01_lstBuildings_'][id$='_dynamicBuildingDataLeftColumn_divSummary']";
  const buildingRightSel =
    "div[id^='ctlBodyPane_ctl04_ctl01_lstBuildings_'][id$='_dynamicBuildingDataRightColumn_divSummary']";
  const $firstLeft = $(buildingLeftSel).first();
  if ($firstLeft && $firstLeft.length) {
    $firstLeft.find("tr").each((i, tr) => {
      const k = $(tr).find("th").text().trim();
      const v = $(tr).find("td").text().trim();
      if (k === "Total Area" && !firstTotalArea) firstTotalArea = v || null;
      if (k === "Heated Area" && !firstHeatedArea) firstHeatedArea = v || null;
    });
  }
  const $firstRight = $(buildingRightSel).first();
  if ($firstRight && $firstRight.length) {
    $firstRight.find("tr").each((i, tr) => {
      const k = $(tr).find("th").text().trim();
      const v = $(tr).find("td").text().trim();
      if (k === "Actual Year Built" && !firstActualYearBuilt)
        firstActualYearBuilt = v || null;
    });
  }

  const propertyObj = {
    parcel_identifier: parcelId,
    property_type: property_type_value,
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: firstActualYearBuilt
      ? parseInt(firstActualYearBuilt, 10)
      : null,
    livable_floor_area: firstHeatedArea || null,
    area_under_air: null,
    historic_designation: false,
    number_of_units: null,
    number_of_units_type: null,
    subdivision: null,
    total_area: firstTotalArea || null,
    zoning: null,
    property_effective_built_year: null,
  };
  writeJSON(path.join(outDir, "property.json"), propertyObj);

  const fullAddress =
    (unAddr && unAddr.full_address) ||
    (parcelSummary["Location Address"]
      ? parcelSummary["Location Address"].replace(/\s+/g, " ").trim()
      : "");
  let street_number = null,
    street_name = null,
    street_suffix_type = null;
  if (fullAddress) {
    const firstPart = fullAddress.split(",")[0].trim();
    const parts = firstPart.split(/\s+/);
    if (parts.length >= 3) {
      street_number = parts[0];
      street_suffix_type = parts[parts.length - 1].toUpperCase();
      street_name = parts.slice(1, parts.length - 1).join(" ");
      const suffixMap = {
        ST: "St",
        RD: "Rd",
        DR: "Dr",
        AVE: "Ave",
        BLVD: "Blvd",
        LN: "Ln",
        CT: "Ct",
        HWY: "Hwy",
        PL: "Pl",
        TER: "Ter",
        CIR: "Cir",
        WAY: "Way",
        PKWY: "Pkwy",
      };
      if (suffixMap[street_suffix_type])
        street_suffix_type = suffixMap[street_suffix_type];
    }
  }
  const cityStateZip = fullAddress.split(",").slice(1).join(",").trim();
  let city_name = null,
    state_code = null,
    postal_code = null;
  if (cityStateZip) {
    const m = cityStateZip.match(
      /([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/,
    );
    if (m) {
      city_name = m[1].trim().toUpperCase();
      state_code = m[2].trim();
      postal_code = m[3].trim();
    }
  }
  const secTwpRng = parcelSummary["Sec/Twp/Rng"] || null;
  let section = null,
    township = null,
    range = null;
  if (secTwpRng && /-/g.test(secTwpRng)) {
    const [sec, twp, rng] = secTwpRng.split("-");
    section = sec || null;
    township = twp || null;
    range = rng || null;
  }
  const addressObj = {
    street_number: street_number || null,
    street_name: street_name || null,
    street_suffix_type: street_suffix_type || null,
    street_pre_directional_text: null,
    street_post_directional_text: null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: city_name
      ? city_name
          .split(/\s+/)
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(" ")
      : null,
    state_code: state_code || "FL",
    postal_code:
      postal_code ||
      (unAddr && unAddr.full_address
        ? (unAddr.full_address.match(/(\d{5})/) || [])[1]
        : null) ||
      null,
    plus_four_postal_code: null,
    country_code: "US",
    county_name: (unAddr && unAddr.county_jurisdiction) || "Gulf",
    latitude: (unAddr && unAddr.latitude) || null,
    longitude: (unAddr && unAddr.longitude) || null,
    route_number: null,
    township: township || null,
    range: range || null,
    section: section || null,
    block: null,
    lot: null,
  };
  writeJSON(path.join(outDir, "address.json"), addressObj);

  // Taxes
  const taxYears = [];
  $("#ctlBodyPane_ctl08_ctl01_grdValuation thead th.value-column").each(
    (i, th) => {
      const txt = $(th).text().trim();
      const m = txt.match(/(\d{4})/);
      if (m) taxYears.push(parseInt(m[1], 10));
    },
  );
  const rowMap = {};
  $("#ctlBodyPane_ctl08_ctl01_grdValuation tbody tr").each((i, tr) => {
    const label = $(tr).find("th").text().trim();
    const vals = [];
    $(tr)
      .find("td.value-column")
      .each((j, td) => vals.push($(td).text().trim()));
    rowMap[label] = vals;
  });
  const labelsNeeded = {
    building: "Building Value",
    land: "Land Value",
    market: "Just (Market) Value",
    assessed: "Assessed Value",
    taxable: "Taxable Value",
  };
  taxYears.forEach((yr, idx) => {
    const obj = {
      tax_year: yr,
      property_assessed_value_amount: parseCurrencyToNumber(
        rowMap[labelsNeeded.assessed]
          ? rowMap[labelsNeeded.assessed][idx]
          : null,
      ),
      property_market_value_amount: parseCurrencyToNumber(
        rowMap[labelsNeeded.market] ? rowMap[labelsNeeded.market][idx] : null,
      ),
      property_building_amount: parseCurrencyToNumber(
        rowMap[labelsNeeded.building]
          ? rowMap[labelsNeeded.building][idx]
          : null,
      ),
      property_land_amount: parseCurrencyToNumber(
        rowMap[labelsNeeded.land] ? rowMap[labelsNeeded.land][idx] : null,
      ),
      property_taxable_value_amount: parseCurrencyToNumber(
        rowMap[labelsNeeded.taxable] ? rowMap[labelsNeeded.taxable][idx] : null,
      ),
      monthly_tax_amount: null,
      yearly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join(outDir, `tax_${yr}.json`), obj);
  });

  // Sales
  const salesRows = [];
  $("#ctlBodyPane_ctl06_ctl01_grdSales tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 8) {
      const saleDate = $(tds[0]).text().trim();
      const salePrice = $(tds[1]).text().trim();
      const instrument = $(tds[2]).text().trim();
      const bookPage = $(tds[3]).text().trim();
      const grantor = $(tds[6]).text().trim();
      const grantee = $(tds[7]).text().trim();
      salesRows.push({
        saleDate,
        salePrice,
        instrument,
        bookPage,
        grantor,
        grantee,
      });
    }
  });
  const nonZero = salesRows.filter(
    (r) => (parseCurrencyToNumber(r.salePrice) ?? 0) > 0,
  );
  const zeroSales = salesRows.filter(
    (r) => (parseCurrencyToNumber(r.salePrice) ?? 0) === 0,
  );
  const orderedSales = [...nonZero, ...zeroSales];

  const salesOutFiles = [];
  orderedSales.forEach((r, idx) => {
    const isoDate = parseMDYToISO(r.saleDate);
    const amt = parseCurrencyToNumber(r.salePrice);
    const salesObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: amt !== null ? amt : 0,
    };
    const salesFile = path.join(outDir, `sales_${idx + 1}.json`);
    writeJSON(salesFile, salesObj);
    salesOutFiles.push({
      file: salesFile,
      idx: idx + 1,
      date: isoDate,
      grantee: r.grantee,
      instrument: r.instrument,
    });
    let deedType = null;
    try {
      deedType = mapDeedTypeFromInstrument(r.instrument);
    } catch (e) {
      if (e && e.type === "error") {
        console.error(JSON.stringify(e));
        process.exit(1);
      } else throw e;
    }
    const deedObj = { deed_type: deedType };
    const deedFile = path.join(outDir, `deed_${idx + 1}.json`);
    writeJSON(deedFile, deedObj);
    const relSD = {
      to: { "/": `./sales_${idx + 1}.json` },
      from: { "/": `./deed_${idx + 1}.json` },
    };
    writeJSON(
      path.join(outDir, `relationship_sales_deed_${idx + 1}.json`),
      relSD,
    );
  });

  // Owners/Companies
  const ownersRoot = ownerDataAll[propertyKey] || {};
  const ownersByDate = ownersRoot.owners_by_date || {};
  const companiesSet = new Set();
  Object.keys(ownersByDate).forEach((k) => {
    (ownersByDate[k] || []).forEach((o) => {
      if (o && o.type === "company" && o.name) companiesSet.add(o.name.trim());
    });
  });
  // Deterministic ordering by name (ascending) to ensure consistent company_1 / company_2 numbering
  const companiesSorted = Array.from(companiesSet).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" }),
  );
  const companyIndexByName = new Map();
  companiesSorted.forEach((name, i) => {
    const idx = i + 1;
    writeJSON(path.join(outDir, `company_${idx}.json`), { name });
    companyIndexByName.set(name, idx);
  });

  // Link sales -> best company match
  salesOutFiles.forEach((s) => {
    const compIdx = bestCompanyMatch(s.grantee, companyIndexByName);
    if (compIdx) {
      const rel = {
        to: { "/": `./company_${compIdx}.json` },
        from: { "/": `./sales_${s.idx}.json` },
      };
      writeJSON(
        path.join(outDir, `relationship_sales_company_${s.idx}.json`),
        rel,
      );
    }
  });

  // Utility
  if (utilitiesData && utilitiesData[propertyKey]) {
    const u = utilitiesData[propertyKey];
    const utilityObj = {
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
      solar_panel_present: u.solar_panel_present ?? false,
      solar_panel_type: u.solar_panel_type ?? null,
      solar_panel_type_other_description:
        u.solar_panel_type_other_description ?? null,
      smart_home_features: u.smart_home_features ?? null,
      smart_home_features_other_description:
        u.smart_home_features_other_description ?? null,
      hvac_unit_condition: u.hvac_unit_condition ?? null,
      solar_inverter_visible: u.solar_inverter_visible ?? false,
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
    writeJSON(path.join(outDir, "utility.json"), utilityObj);
  }

  // Layouts
  if (
    layoutData &&
    layoutData[propertyKey] &&
    Array.isArray(layoutData[propertyKey].layouts)
  ) {
    layoutData[propertyKey].layouts.forEach((L) => {
      const out = {
        space_type: L.space_type ?? null,
        space_index: L.space_index,
        flooring_material_type: L.flooring_material_type ?? null,
        size_square_feet: L.size_square_feet ?? null,
        floor_level: L.floor_level ?? null,
        has_windows: L.has_windows ?? null,
        window_design_type: L.window_design_type ?? null,
        window_material_type: L.window_material_type ?? null,
        window_treatment_type: L.window_treatment_type ?? null,
        is_finished: L.is_finished === undefined ? null : L.is_finished,
        furnished: L.furnished ?? null,
        paint_condition: L.paint_condition ?? null,
        flooring_wear: L.flooring_wear ?? null,
        clutter_level: L.clutter_level ?? null,
        visible_damage: L.visible_damage ?? null,
        countertop_material: L.countertop_material ?? null,
        cabinet_style: L.cabinet_style ?? null,
        fixture_finish_quality: L.fixture_finish_quality ?? null,
        design_style: L.design_style ?? null,
        natural_light_quality: L.natural_light_quality ?? null,
        decor_elements: L.decor_elements ?? null,
        pool_type: L.pool_type ?? null,
        pool_equipment: L.pool_equipment ?? null,
        spa_type: L.spa_type ?? null,
        safety_features: L.safety_features ?? null,
        view_type: L.view_type ?? null,
        lighting_features: L.lighting_features ?? null,
        condition_issues: L.condition_issues ?? null,
        is_exterior: L.is_exterior === undefined ? null : L.is_exterior,
        pool_condition: L.pool_condition ?? null,
        pool_surface_type: L.pool_surface_type ?? null,
        pool_water_quality: L.pool_water_quality ?? null,
        bathroom_renovation_date: L.bathroom_renovation_date ?? null,
        kitchen_renovation_date: L.kitchen_renovation_date ?? null,
        flooring_installation_date: L.flooring_installation_date ?? null,
      };
      writeJSON(path.join(outDir, `layout_${L.space_index}.json`), out);
    });
  }

  // Structure
  if ($firstLeft && $firstRight) {
    let extWalls = null,
      roofCover = null,
      intWalls = null,
      frameType = null,
      floorCover = null;
    $firstLeft.find("tr").each((i, tr) => {
      const k = $(tr).find("th").text().trim().toUpperCase();
      const v = $(tr).find("td").text().trim().toUpperCase();
      if (k === "EXTERIOR WALLS") extWalls = v;
      if (k === "ROOF COVER") roofCover = v;
      if (k === "INTERIOR WALLS") intWalls = v;
      if (k === "FRAME TYPE") frameType = v;
      if (k === "FLOOR COVER") floorCover = v;
    });
    function mapExtPrimarySecondary(s) {
      let primary = null,
        secondary = null;
      if (!s) return { primary, secondary };
      const parts = s.split(/;\s*/);
      parts.forEach((p) => {
        if (p.includes("BRK")) primary = primary || "Brick";
        if (p.includes("VINYL")) secondary = secondary || "Vinyl Accent";
      });
      return { primary, secondary };
    }
    function mapRoofCovering(s) {
      if (!s) return null;
      if (s.includes("COMP") && s.includes("SHNGL"))
        return "3-Tab Asphalt Shingle";
      return null;
    }
    function mapFloor(s) {
      if (!s) return null;
      if (s.includes("CARPET")) return "Carpet";
      return null;
    }
    function mapInteriorWallSurface(s) {
      if (!s) return null;
      if (s.includes("DRYWALL")) return "Drywall";
      return null;
    }
    function mapFrame(s) {
      if (!s) return null;
      if (s.includes("WOOD")) return "Wood Frame";
      return null;
    }
    const { primary: extPrimary, secondary: extSecondary } =
      mapExtPrimarySecondary(extWalls);
    const structureObj = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: extPrimary ?? null,
      exterior_wall_material_secondary: extSecondary ?? null,
      exterior_wall_condition: null,
      exterior_wall_insulation_type: "Unknown",
      flooring_material_primary: mapFloor(floorCover) ?? null,
      flooring_material_secondary: null,
      subfloor_material: null,
      flooring_condition: null,
      interior_wall_structure_material: mapFrame(frameType) ?? null,
      interior_wall_surface_material_primary:
        mapInteriorWallSurface(intWalls) ?? null,
      interior_wall_surface_material_secondary: null,
      interior_wall_finish_primary: null,
      interior_wall_finish_secondary: null,
      interior_wall_condition: null,
      roof_covering_material: mapRoofCovering(roofCover) ?? null,
      roof_underlayment_type: "Unknown",
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
      primary_framing_material: mapFrame(frameType) ?? null,
      secondary_framing_material: null,
      structural_damage_indicators: null,
    };
    writeJSON(path.join(outDir, "structure.json"), structureObj);
  }

  // Files (sketch images)
  const fileUrls = [];
  $("#sketchgrid img.rsImg").each((i, img) => {
    const src = $(img).attr("src");
    if (src && !fileUrls.includes(src)) fileUrls.push(src);
  });
  if (fileUrls.length === 0) {
    $("#sketchlist a.rsImg").each((i, a) => {
      const href = $(a).attr("href");
      if (href && !fileUrls.includes(href)) fileUrls.push(href);
    });
  }
  fileUrls.forEach((url, i) => {
    const fileObj = {
      file_format: "jpeg",
      name: `Sketch ${i + 1}`,
      original_url: url,
      ipfs_url: null,
      document_type: "PropertyImage",
    };
    writeJSON(path.join(outDir, `file_${i + 1}.json`), fileObj);
  });
}

try {
  main();
  console.log("Extraction complete.");
} catch (err) {
  if (err && err.type === "error") {
    console.error(JSON.stringify(err));
    process.exit(1);
  } else {
    console.error(err);
    process.exit(1);
  }
}
