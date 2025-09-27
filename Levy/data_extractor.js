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
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function safeUnlink(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || isNaN(Number(s))) return null;
  return Number(Number(s).toFixed(2));
}

function toISODate(mdY) {
  if (!mdY) return null;
  const m = String(mdY).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;
  const parts = m.split(/[\/\-]/);
  if (parts.length === 3) {
    let [mm, dd, yyyy] = parts;
    if (yyyy.length === 2) {
      const yy = parseInt(yyyy, 10);
      yyyy = (yy >= 80 ? "19" : "20") + (yy < 10 ? "0" + yy : String(yy));
    }
    const month = mm.padStart(2, "0");
    const day = dd.padStart(2, "0");
    return `${yyyy}-${month}-${day}`;
  }
  return null;
}

function titleCaseName(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (s === "") return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeMiddleName(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (s === "") return null;
  if (s.length === 1) return s.toUpperCase();
  return titleCaseName(s);
}

function mapPropertyType(usageText, useDescText) {
  const text = ((usageText || "") + " " + (useDescText || "")).toUpperCase();
  if (text.includes("SINGLE FAMILY")) return "SingleFamily";
  if (text.includes("DUPLEX")) return "Duplex";
  if (text.includes("TRIPLEX") || text.includes("3")) return "3Units";
  if (text.includes("QUAD") || text.includes("4")) return "4Units";
  if (text.includes("CONDO")) return "Condominium";
  if (text.includes("TOWNHOUSE") || text.includes("TOWNHOME"))
    return "Townhouse";
  if (text.includes("MOBILE HOME")) return "MobileHome";
  if (text.includes("MULTI-FAMILY") || text.includes("MULTI FAMILY"))
    return "MultipleFamily";
  if (text.includes("VACANT")) return "VacantLand";
  const err = {
    type: "error",
    message: `Unknown enum value ${usageText || useDescText}.`,
    path: "property.property_type",
  };
  throw new Error(JSON.stringify(err));
}

function mapUnitsType(propType) {
  switch (propType) {
    case "SingleFamily":
      return "One";
    case "Duplex":
      return "Two";
    case "3Units":
      return "Three";
    case "4Units":
      return "Four";
    case "MultipleFamily":
      return "TwoToFour";
    default:
      return "OneToFour";
  }
}

function mapDeedType(instr) {
  const s = (instr || "").trim().toUpperCase();
  if (s === "WD" || s === "WM") return "Warranty Deed";
  if (s === "QD") return "Quitclaim Deed";
  if (s === "CT") return "Contract for Deed";
  if (s === "FJ") return "Court Order Deed";
  // Unknown -> return null (deed object may be empty)
  return null;
}

function inferExteriorWallMaterial(val) {
  const s = (val || "").toUpperCase();
  if (s.includes("HARDIE")) return "Fiber Cement Siding";
  if (s.includes("STUCCO")) return "Stucco";
  if (s.includes("BRICK")) return "Brick";
  if (s.includes("BLOCK")) return "Concrete Block";
  return null;
}

function inferRoofDesign(val) {
  const s = (val || "").toUpperCase();
  if (s.includes("GABLE") && s.includes("HIP")) return "Combination";
  if (s.includes("GABLE")) return "Gable";
  if (s.includes("HIP")) return "Hip";
  if (s.includes("FLAT")) return "Flat";
  return null;
}

(function main() {
  try {
    const dataDir = path.join(".", "data");
    ensureDir(dataDir);

    const html = fs.readFileSync("input.html", "utf8");
    const unnormalizedAddress = readJSON("unnormalized_address.json");
    const propertySeed = readJSON("property_seed.json");

    const ownersPath = path.join("owners", "owner_data.json");
    const utilsPath = path.join("owners", "utilities_data.json");
    const layoutPath = path.join("owners", "layout_data.json");

    const ownersData = fs.existsSync(ownersPath) ? readJSON(ownersPath) : null;
    const utilitiesData = fs.existsSync(utilsPath) ? readJSON(utilsPath) : null;
    const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

    const $ = cheerio.load(html);

    // PROPERTY
    const parcelIdHtml = $("#ctlBodyPane_ctl02_ctl01_lblParcelID")
      .text()
      .trim();
    const parcel_identifier =
      propertySeed && propertySeed.parcel_id
        ? propertySeed.parcel_id
        : parcelIdHtml;

    const legalDesc =
      $("#ctlBodyPane_ctl02_ctl01_lblLegalDescription").text().trim() || null;
    const subdivision =
      $("#ctlBodyPane_ctl02_ctl01_lblSubdivision").text().trim() || null;
    const usageText =
      $("#ctlBodyPane_ctl02_ctl01_lblUsage").text().trim() || null;

    const buildingSection = $("#ctlBodyPane_ctl08_mSection");
    function findValueByExactLabel(section, label) {
      const th = section
        .find("th")
        .filter(
          (i, el) => $(el).text().trim().toLowerCase() === label.toLowerCase(),
        )
        .first();
      if (!th.length) return null;
      const td = th.closest("tr").find("td").first();
      return td.text().trim() || null;
    }

    const conditionedArea = findValueByExactLabel(
      buildingSection,
      "Conditioned Area",
    );
    const actualArea = findValueByExactLabel(buildingSection, "Actual Area");
    const actualYearBuilt = findValueByExactLabel(
      buildingSection,
      "Actual Year Built",
    );
    const effectiveYearBuilt = findValueByExactLabel(
      buildingSection,
      "Effective Year Built",
    );
    const useDescText = findValueByExactLabel(buildingSection, "Use");

    const property_type = mapPropertyType(usageText, useDescText);
    const number_of_units_type = mapUnitsType(property_type);

    const propertyObj = {
      parcel_identifier: String(parcel_identifier),
      property_legal_description_text: legalDesc,
      property_structure_built_year: actualYearBuilt
        ? parseInt(actualYearBuilt, 10)
        : null,
      property_effective_built_year: effectiveYearBuilt
        ? parseInt(effectiveYearBuilt, 10)
        : null,
      property_type,
      livable_floor_area: conditionedArea ? String(conditionedArea) : null,
      total_area: actualArea ? String(actualArea) : null,
      area_under_air: conditionedArea ? String(conditionedArea) : null,
      subdivision,
      number_of_units_type,
    };

    writeJSON(path.join(dataDir, "property.json"), propertyObj);

    // ADDRESS – always write with required keys present (nullable allowed by schema)
    const fullAddr =
      unnormalizedAddress && unnormalizedAddress.full_address
        ? unnormalizedAddress.full_address
        : null;
    let street_number = null,
      street_pre_directional_text = null,
      street_name = null,
      street_suffix_type = null,
      unit_identifier = null;
    let city_name = null,
      state_code = null,
      postal_code = null,
      plus_four_postal_code = null;

    if (fullAddr) {
      const parts = fullAddr.split(",");
      const first = (parts[0] || "").trim();
      const rest = parts.slice(1).join(",").trim();
      const tokens = first.split(/\s+/);
      if (tokens.length >= 3) {
        street_number = tokens[0];
        street_pre_directional_text = tokens[1].toUpperCase();
        // suffix
        const lastTok = tokens[tokens.length - 1].toUpperCase();
        const suffixMap = {
          ALY: "Aly",
          AVE: "Ave",
          AV: "Ave",
          AVENUE: "Ave",
          BLVD: "Blvd",
          CIR: "Cir",
          CT: "Ct",
          DR: "Dr",
          HWY: "Hwy",
          LN: "Ln",
          PL: "Pl",
          RD: "Rd",
          "RD.": "Rd",
          RDG: "Rdg",
          PKWY: "Pkwy",
          ST: "St",
          TER: "Ter",
          TRL: "Trl",
          WAY: "Way",
        };
        street_suffix_type = suffixMap[lastTok] || null;
        const nameParts = tokens.slice(
          2,
          street_suffix_type ? tokens.length - 1 : tokens.length,
        );
        street_name = nameParts.join(" ");
      }
      const m2 = rest.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?$/);
      if (m2) {
        city_name = m2[1].trim().toUpperCase();
        state_code = m2[2];
        postal_code = m2[3];
        plus_four_postal_code = m2[4] || null;
      }
    }

    let section = null,
      township = null,
      range = null;
    const strSTR = $("#ctlBodyPane_ctl02_ctl01_lblSecTwpRng").text().trim();
    if (strSTR) {
      const a = strSTR.split("-");
      if (a.length === 3) {
        section = a[0];
        township = a[1];
        range = a[2];
      }
    }

    const addressObj = {
      street_number: street_number || null,
      street_pre_directional_text: street_pre_directional_text || null,
      street_name: street_name || null,
      street_suffix_type: street_suffix_type || null,
      street_post_directional_text: null,
      unit_identifier: unit_identifier || null,
      city_name: city_name || null,
      municipality_name: null,
      county_name: "Levy",
      state_code: state_code || null,
      postal_code: postal_code || null,
      plus_four_postal_code: plus_four_postal_code || null,
      country_code: "US",
      latitude: null,
      longitude: null,
      lot: null,
      block: null,
      section: section || null,
      township: township || null,
      range: range || null,
      route_number: null,
    };
    writeJSON(path.join(dataDir, "address.json"), addressObj);

    // TAX – from Valuation table
    const valTableRows = $("#ctlBodyPane_ctl06_ctl01_grdValuation tbody tr");
    const getVal = (rowLabel) => {
      const row = valTableRows.filter(
        (i, el) =>
          $(el).find("th").first().text().trim().toLowerCase() ===
          rowLabel.toLowerCase(),
      );
      if (!row.length) return null;
      const valTxt = row.first().find("td").last().text().trim();
      return parseCurrencyToNumber(valTxt);
    };

    let taxYear = null;
    const headerTxt = $("#ctlBodyPane_ctl06_ctl01_grdValuation thead th")
      .last()
      .text();
    const mHeader = headerTxt && headerTxt.match(/(\d{4})/);
    if (mHeader) taxYear = parseInt(mHeader[1], 10);

    if (taxYear) {
      const taxObj = {
        tax_year: taxYear,
        property_building_amount: getVal("Building Value"),
        property_land_amount: getVal("Market Land Value"),
        property_market_value_amount: getVal("Just (Market) Value"),
        property_assessed_value_amount: getVal("Assessed Value"),
        property_taxable_value_amount: getVal("Taxable Value"),
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
      };
      writeJSON(path.join(dataDir, `tax_${taxYear}.json`), taxObj);
    }

    // SALES + DEEDS – parse all rows (including $0.00)
    const salesRows = $("#ctlBodyPane_ctl11_ctl01_grdSales tbody tr");
    let salesIndex = 0;
    const salesDateToIndex = new Map();

    salesRows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const dateTxt = $(tds[0]).text().trim();
      const priceTxt = $(tds[1]).text().trim();
      const instrTxt = $(tds[2]).text().trim();
      const iso = toISODate(dateTxt);
      const price = parseCurrencyToNumber(priceTxt);
      if (!iso || price == null) return;

      const saleObj = {
        ownership_transfer_date: iso,
        purchase_price_amount: price,
      };
      salesIndex += 1;
      const salesFile = path.join(dataDir, `sales_${salesIndex}.json`);
      writeJSON(salesFile, saleObj);
      if (!salesDateToIndex.has(iso)) salesDateToIndex.set(iso, []);
      salesDateToIndex.get(iso).push(salesIndex);

      // Deed corresponding to this sale
      const deedType = mapDeedType(instrTxt);
      const deedObj = {};
      if (deedType) deedObj.deed_type = deedType;
      const deedFile = path.join(dataDir, `deed_${salesIndex}.json`);
      writeJSON(deedFile, deedObj);
      // Relationship sales -> deed
      const relSD = {
        to: { "/": `./sales_${salesIndex}.json` },
        from: { "/": `./deed_${salesIndex}.json` },
      };
      writeJSON(
        path.join(dataDir, `relationship_sales_deed_${salesIndex}.json`),
        relSD,
      );
    });

    // OWNERS – from owners/owner_data.json only
    let personCounter = 0;
    let companyCounter = 0;
    let relPersonCounter = 0;
    let relCompanyCounter = 0;

    const personKeyToIndex = new Map();
    const companyNameToIndex = new Map();

    function writePerson(first, last, middle) {
      const key = `${first}|${middle || ""}|${last}`.toLowerCase();
      if (personKeyToIndex.has(key)) return personKeyToIndex.get(key);
      personCounter += 1;
      const personObj = {
        birth_date: null,
        first_name: titleCaseName(first),
        last_name: titleCaseName(last),
        middle_name: normalizeMiddleName(middle),
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(path.join(dataDir, `person_${personCounter}.json`), personObj);
      personKeyToIndex.set(key, personCounter);
      return personCounter;
    }

    function writeCompany(name) {
      const norm = String(name).trim();
      if (companyNameToIndex.has(norm)) return companyNameToIndex.get(norm);
      companyCounter += 1;
      const companyObj = { name: norm };
      writeJSON(
        path.join(dataDir, `company_${companyCounter}.json`),
        companyObj,
      );
      companyNameToIndex.set(norm, companyCounter);
      return companyCounter;
    }

    if (
      ownersData &&
      ownersData[`property_${parcel_identifier}`] &&
      ownersData[`property_${parcel_identifier}`].owners_by_date
    ) {
      const byDate = ownersData[`property_${parcel_identifier}`].owners_by_date;
      for (const [isoDate, saleIdxList] of salesDateToIndex.entries()) {
        const ownersOnDate = byDate[isoDate];
        if (!ownersOnDate || !Array.isArray(ownersOnDate)) continue;
        for (const owner of ownersOnDate) {
          if (owner.type === "person") {
            const pIndex = writePerson(
              owner.first_name,
              owner.last_name,
              owner.middle_name,
            );
            for (const sIdx of saleIdxList) {
              relPersonCounter += 1;
              const rel = {
                to: { "/": `./person_${pIndex}.json` },
                from: { "/": `./sales_${sIdx}.json` },
              };
              writeJSON(
                path.join(
                  dataDir,
                  `relationship_sales_person_${relPersonCounter}.json`,
                ),
                rel,
              );
            }
          } else if (owner.type === "company") {
            const cIndex = writeCompany(owner.name);
            for (const sIdx of saleIdxList) {
              relCompanyCounter += 1;
              const rel = {
                to: { "/": `./company_${cIndex}.json` },
                from: { "/": `./sales_${sIdx}.json` },
              };
              writeJSON(
                path.join(
                  dataDir,
                  `relationship_sales_company_${relCompanyCounter}.json`,
                ),
                rel,
              );
            }
          }
        }
      }
    }

    // UTILITIES – strictly from owners/utilities_data.json
    if (utilitiesData && utilitiesData[`property_${parcel_identifier}`]) {
      const u = utilitiesData[`property_${parcel_identifier}`];
      const utilObj = {
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
        solar_panel_present: u.solar_panel_present === true,
        solar_panel_type: u.solar_panel_type ?? null,
        solar_panel_type_other_description:
          u.solar_panel_type_other_description ?? null,
        smart_home_features: Array.isArray(u.smart_home_features)
          ? u.smart_home_features
          : null,
        smart_home_features_other_description:
          u.smart_home_features_other_description ?? null,
        hvac_unit_condition: u.hvac_unit_condition ?? null,
        solar_inverter_visible: u.solar_inverter_visible === true,
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
        water_heater_installation_date:
          u.water_heater_installation_date ?? null,
        water_heater_manufacturer: u.water_heater_manufacturer ?? null,
        water_heater_model: u.water_heater_model ?? null,
        well_installation_date: u.well_installation_date ?? null,
      };
      writeJSON(path.join(dataDir, "utility.json"), utilObj);
    }

    // LAYOUT – strictly from owners/layout_data.json
    if (
      layoutData &&
      layoutData[`property_${parcel_identifier}`] &&
      Array.isArray(layoutData[`property_${parcel_identifier}`].layouts)
    ) {
      const layouts = layoutData[`property_${parcel_identifier}`].layouts;
      layouts.forEach((lay, idx) => {
        const out = { ...lay };
        writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), out);
      });
    }

    // LOT – from HTML (limited), output nulls where not available
    const acreageTxt = $("#ctlBodyPane_ctl02_ctl01_lblGrossAcres")
      .text()
      .trim();
    let lot_size_acre = null;
    if (acreageTxt && !isNaN(Number(acreageTxt)))
      lot_size_acre = Number(acreageTxt);
    const lotObj = {
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
      lot_size_acre,
    };
    writeJSON(path.join(dataDir, "lot.json"), lotObj);

    // STRUCTURE – from Building Information section
    const extWallRaw = findValueByExactLabel(buildingSection, "Exterior Wall");
    const roofStructRaw = findValueByExactLabel(
      buildingSection,
      "Roof Structure",
    );
    const roofCoverRaw = findValueByExactLabel(buildingSection, "Roof Cover");
    const finishedBaseRaw = (() => {
      // subArea table total of BASE Actual Area or find 'BASE' row
      const rows = $(
        "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_subArea tbody tr",
      );
      let base = null;
      rows.each((i, r) => {
        const th = $(r).find("th").text().trim().toUpperCase();
        if (th === "BASE") {
          const tds = $(r).find("td");
          if (tds.length >= 2) {
            base = parseInt($(tds[1]).text().trim(), 10);
          }
        }
      });
      return base;
    })();

    const structureObj = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: inferExteriorWallMaterial(extWallRaw),
      exterior_wall_material_secondary: null,
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
      roof_covering_material: null, // unknown specific metal type
      roof_underlayment_type: null,
      roof_structure_material: null,
      roof_design_type: inferRoofDesign(roofStructRaw),
      roof_condition: null,
      roof_age_years: null,
      gutters_material: null,
      gutters_condition: null,
      roof_material_type:
        roofCoverRaw && roofCoverRaw.toUpperCase().includes("METAL")
          ? "Metal"
          : null,
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
      primary_framing_material: null,
      secondary_framing_material: null,
      structural_damage_indicators: null,
      finished_base_area:
        typeof finishedBaseRaw === "number" ? finishedBaseRaw : null,
    };
    writeJSON(path.join(dataDir, "structure.json"), structureObj);

    // FILES – Trim Notice PDF and Building Sketch image
    // Building Sketch image
    const sketchImg =
      $("#ctlBodyPane_ctl13_mSection img.rsImg").attr("src") || null;
    if (sketchImg) {
      const file1 = {
        document_type: "PropertyImage",
        file_format: "jpeg",
        ipfs_url: null,
        name: "Building Sketch 1",
        original_url: sketchImg,
      };
      writeJSON(path.join(dataDir, "file_1.json"), file1);
    }
    // Trim Notice button (onclick with window.open)
    const trimBtn = $(
      "#ctlBodyPane_ctl04_ctl01_prtrFiles_Button_ctl00_prtrFiles_Button_Inner_ctl00_btnName",
    );
    let trimUrl = null;
    if (trimBtn && trimBtn.attr("onclick")) {
      const m = trimBtn.attr("onclick").match(/window\.open\('([^']+)'\)/);
      if (m) trimUrl = m[1];
    }
    if (trimUrl) {
      const file2 = {
        document_type: null,
        file_format: null,
        ipfs_url: null,
        name: "Trim Notice",
        original_url: trimUrl,
      };
      writeJSON(path.join(dataDir, "file_2.json"), file2);
    }
  } catch (e) {
    try {
      const obj = JSON.parse(e.message);
      if (obj && obj.type === "error") {
        console.error(JSON.stringify(obj));
        process.exit(1);
      }
    } catch (_) {}
    console.error(e.stack || String(e));
    process.exit(1);
  }
})();
