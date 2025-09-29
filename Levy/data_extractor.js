// const fs = require("fs");
// const path = require("path");
// const cheerio = require("cheerio");

// function ensureDir(p) {
//   if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
// }

// function cleanDir(p) {
//   if (!fs.existsSync(p)) return;
//   const entries = fs.readdirSync(p);
//   for (const f of entries) {
//     const fp = path.join(p, f);
//     const stat = fs.statSync(fp);
//     if (stat.isDirectory()) {
//       cleanDir(fp);
//       fs.rmdirSync(fp);
//     } else {
//       fs.unlinkSync(fp);
//     }
//   }
// }

// function readJSON(p) {
//   try {
//     return JSON.parse(fs.readFileSync(p, "utf8"));
//   } catch (e) {
//     return null;
//   }
// }

// function writeJSON(p, obj) {
//   fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
// }

// function parseCurrency(str) {
//   if (str == null) return null;
//   const s = String(str).replace(/[$,\s]/g, "");
//   if (s === "" || isNaN(Number(s))) return null;
//   return Number(Number(s).toFixed(2));
// }

// function toISODate(mdyyyy) {
//   if (!mdyyyy) return null;
//   const m = String(mdyyyy).trim();
//   const parts = m.split(/[\/-]/);
//   if (parts.length !== 3) return null;
//   let [mm, dd, yyyy] = parts;
//   if (yyyy.length === 2) yyyy = (Number(yyyy) < 50 ? "20" : "19") + yyyy;
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${yyyy}-${pad(mm)}-${pad(dd)}`;
// }

// function titleCaseName(s) {
//   if (!s) return null;
//   return s
//     .toLowerCase()
//     .split(/\s|\-|\'|\./)
//     .filter(Boolean)
//     .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//     .join(" ");
// }

// function extractText($, sel) {
//   const el = $(sel);
//   if (!el || el.length === 0) return null;
//   return el.text().trim() || null;
// }

// function parseSecTwpRng(str) {
//   if (!str) return { section: null, township: null, range: null };
//   const m = String(str)
//     .trim()
//     .match(/^(\d+)-(\d+)-(\d+)$/);
//   if (!m) return { section: null, township: null, range: null };
//   return { section: m[1], township: m[2], range: m[3] };
// }

// function parseAddressFromFull(full) {
//   if (!full) return {};
//   const out = {
//     street_number: null,
//     street_pre_directional_text: null,
//     street_name: null,
//     street_suffix_type: null,
//     street_post_directional_text: null,
//     city_name: null,
//     state_code: null,
//     postal_code: null,
//     plus_four_postal_code: null,
//   };
//   try {
//     const mainParts = full.split(",");
//     const line1 = (mainParts[0] || "").trim();
//     const city = (mainParts[1] || "").trim();
//     const stateZip = (mainParts[2] || "").trim();

//     const tokens = line1.split(/\s+/);
//     if (tokens.length >= 2) {
//       out.street_number = tokens[0];
//       const pre = tokens[1].toUpperCase();
//       const preSet = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
//       if (preSet.has(pre)) {
//         out.street_pre_directional_text = pre;
//         const rest = tokens.slice(2);
//         if (rest.length > 0) {
//           const last = rest[rest.length - 1];
//           const suffixMap = {
//             AVE: "Ave",
//             AVENUE: "Ave",
//             RD: "Rd",
//             ROAD: "Rd",
//             ST: "St",
//             STREET: "St",
//             DR: "Dr",
//             DRIVE: "Dr",
//             LN: "Ln",
//             LANE: "Ln",
//             BLVD: "Blvd",
//             HWY: "Hwy",
//             CT: "Ct",
//             COURT: "Ct",
//             TER: "Ter",
//             TERRACE: "Ter",
//             PL: "Pl",
//             PLACE: "Pl",
//             WAY: "Way",
//             PKWY: "Pkwy",
//             CIR: "Cir",
//             CIRCLE: "Cir",
//           };
//           const sufNorm = suffixMap[last.toUpperCase()];
//           if (sufNorm) {
//             out.street_suffix_type = sufNorm;
//             const nameTokens = rest.slice(0, -1);
//             out.street_name = nameTokens.join(" ").trim() || null;
//           } else {
//             out.street_name = rest.join(" ").trim() || null;
//           }
//         }
//       } else {
//         const rest = tokens.slice(1);
//         if (rest.length > 0) {
//           const last = rest[rest.length - 1];
//           const suffixMap = {
//             AVE: "Ave",
//             AVENUE: "Ave",
//             RD: "Rd",
//             ROAD: "Rd",
//             ST: "St",
//             STREET: "St",
//             DR: "Dr",
//             DRIVE: "Dr",
//             LN: "Ln",
//             LANE: "Ln",
//             BLVD: "Blvd",
//             HWY: "Hwy",
//             CT: "Ct",
//             COURT: "Ct",
//             TER: "Ter",
//             TERRACE: "Ter",
//             PL: "Pl",
//             PLACE: "Pl",
//             WAY: "Way",
//             PKWY: "Pkwy",
//             CIR: "Cir",
//             CIRCLE: "Cir",
//           };
//           const sufNorm = suffixMap[last.toUpperCase()];
//           if (sufNorm) {
//             out.street_suffix_type = sufNorm;
//             const nameTokens = rest.slice(0, -1);
//             out.street_name = nameTokens.join(" ").trim() || null;
//           } else {
//             out.street_name = rest.join(" ").trim() || null;
//           }
//         }
//       }
//     }

//     out.city_name = city ? city.toUpperCase() : null;
//     const m = stateZip.match(/([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?/);
//     if (m) {
//       out.state_code = m[1];
//       out.postal_code = m[2];
//       out.plus_four_postal_code = m[3] || null;
//     }
//   } catch (e) {}
//   return out;
// }

// function main() {
//   ensureDir("data");
//   cleanDir("data");

//   const htmlPath = "input.html";
//   const addrPath = "unnormalized_address.json";
//   const seedPath = "property_seed.json";
//   const ownersPath = path.join("owners", "owner_data.json");
//   const utilitiesPath = path.join("owners", "utilities_data.json");
//   const layoutPath = path.join("owners", "layout_data.json");

//   const html = fs.readFileSync(htmlPath, "utf8");
//   const $ = cheerio.load(html);

//   const seed = readJSON(seedPath) || {};
//   const addrRaw = readJSON(addrPath) || {};
//   const ownerData = readJSON(ownersPath) || {};
//   const utilitiesData = readJSON(utilitiesPath) || {};
//   const layoutData = readJSON(layoutPath) || {};

//   const parcelId =
//     seed.parcel_id || extractText($, "#ctlBodyPane_ctl02_ctl01_lblParcelID");

//   // PROPERTY
//   const legalDesc = extractText(
//     $,
//     "#ctlBodyPane_ctl02_ctl01_lblLegalDescription",
//   );
//   const subdivision = extractText($, "#ctlBodyPane_ctl02_ctl01_lblSubdivision");
//   const secTwpRng = extractText($, "#ctlBodyPane_ctl02_ctl01_lblSecTwpRng");
//   const propUseCode = extractText($, "#ctlBodyPane_ctl02_ctl01_lblUsage") || "";

//   // Lot acreage
//   const acreageStr = extractText($, "#ctlBodyPane_ctl02_ctl01_lblGrossAcres");
//   const lotSizeAcre = acreageStr ? parseFloat(acreageStr) : null;

//   // Building info
//   const actualArea = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl01_pnlSingleValue span",
//   );
//   const conditionedArea = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl02_pnlSingleValue span",
//   );
//   const actualYearBuilt = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl03_pnlSingleValue span",
//   );
//   const effectiveYearBuilt = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl04_pnlSingleValue span",
//   );

//   let property_type = "SingleFamily";
//   if (!/SINGLE\s+FAMILY/i.test(propUseCode || "")) {
//     const useVal = extractText(
//       $,
//       "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl05_pnlSingleValue span",
//     );
//     if (!/SINGLE\s+FAMILY/i.test(useVal || "")) {
//       property_type = "MiscellaneousResidential";
//     }
//   }
//   let number_of_units_type = null;
//   if (/SINGLE\s+FAMILY/i.test(propUseCode)) number_of_units_type = "One";

//   const property = {
//     parcel_identifier: parcelId || "",
//     property_legal_description_text: legalDesc || null,
//     property_structure_built_year: actualYearBuilt
//       ? Number(actualYearBuilt)
//       : null,
//     property_effective_built_year: effectiveYearBuilt
//       ? Number(effectiveYearBuilt)
//       : null,
//     property_type,
//     number_of_units_type,
//     number_of_units: /SINGLE\s+FAMILY/i.test(propUseCode) ? 1 : null,
//     subdivision: subdivision || null,
//     livable_floor_area: conditionedArea ? String(conditionedArea) : null,
//     area_under_air: conditionedArea ? String(conditionedArea) : null,
//     total_area: actualArea ? String(actualArea) : null,
//     zoning: null,
//     historic_designation: undefined,
//   };
//   writeJSON(path.join("data", "property.json"), property);

//   // ADDRESS
//   const fullAddr =
//     addrRaw.full_address ||
//     extractText($, "#ctlBodyPane_ctl02_ctl01_lblPropertyAddress");
//   const addrParts = parseAddressFromFull(fullAddr);
//   const { section, township, range } = parseSecTwpRng(secTwpRng);

//   if (addrParts.street_name) {
//     const dirRegex = /\b(E|N|NE|NW|S|SE|SW|W)\b/i;
//     if (dirRegex.test(addrParts.street_name)) {
//       addrParts.street_name = addrParts.street_name
//         .replace(dirRegex, "")
//         .trim();
//       if (addrParts.street_name === "") addrParts.street_name = null;
//     }
//   }

//   const address = {
//     street_number: addrParts.street_number || null,
//     street_pre_directional_text: addrParts.street_pre_directional_text || null,
//     street_name: addrParts.street_name || null,
//     street_suffix_type: addrParts.street_suffix_type || null,
//     street_post_directional_text: null,
//     city_name: addrParts.city_name || null,
//     state_code: addrParts.state_code || null,
//     postal_code: addrParts.postal_code || null,
//     plus_four_postal_code: addrParts.plus_four_postal_code || null,
//     country_code: "US",
//     county_name: "Levy",
//     municipality_name: null,
//     unit_identifier: null,
//     route_number: null,
//     lot: null,
//     block: null,
//     longitude: null,
//     latitude: null,
//     section: section || null,
//     township: township || null,
//     range: range || null,
//   };
//   writeJSON(path.join("data", "address.json"), address);

//   // TAX (2025 Preliminary Value Summary)
//   const taxYearHeader = extractText(
//     $,
//     "#ctlBodyPane_ctl06_ctl01_grdValuation thead th.value-column",
//   );
//   let taxYear = null;
//   if (taxYearHeader) {
//     const m = taxYearHeader.match(/(\d{4})/);
//     if (m) taxYear = Number(m[1]);
//   }
//   function getValuationRow(label) {
//     const rows = $("#ctlBodyPane_ctl06_ctl01_grdValuation tbody tr");
//     let val = null;
//     rows.each((i, tr) => {
//       const th = $(tr).find("th").text().trim();
//       const td = $(tr).find("td.value-column").text().trim();
//       if (th.toLowerCase() === label.toLowerCase()) {
//         val = parseCurrency(td);
//       }
//     });
//     return val;
//   }
//   if (taxYear) {
//     const property_building_amount = getValuationRow("Building Value");
//     const property_land_amount = getValuationRow("Market Land Value");
//     const property_market_value_amount = getValuationRow("Just (Market) Value");
//     const property_assessed_value_amount = getValuationRow("Assessed Value");
//     const property_taxable_value_amount = getValuationRow("Taxable Value");

//     const tax = {
//       tax_year: taxYear,
//       property_assessed_value_amount,
//       property_market_value_amount,
//       property_building_amount,
//       property_land_amount,
//       property_taxable_value_amount,
//       monthly_tax_amount: null,
//       period_end_date: null,
//       period_start_date: null,
//       yearly_tax_amount: null,
//       first_year_on_tax_roll: null,
//       first_year_building_on_tax_roll: null,
//     };
//     writeJSON(path.join("data", `tax_${taxYear}.json`), tax);
//   }

//   // SALES, DEEDS, FILES, RELATIONSHIPS
//   const salesRows = $("#ctlBodyPane_ctl11_ctl01_grdSales tbody tr");
//   const errors = [];

//   // owner mapping by date
//   const ownersByDate =
//     ((ownerData || {}).property_1664800000 || {}).owners_by_date || {};

//   let saleIndex = 0;
//   salesRows.each((i, tr) => {
//     const tds = $(tr).find("td");
//     if (tds.length < 9) return;
//     const saleDate = $(tds[0]).text().trim();
//     const salePrice = $(tds[1]).text().trim();
//     const instrType = $(tds[2]).text().trim();
//     const bookEl = $(tds[3]).find("a");
//     const pageEl = $(tds[4]).find("a");

//     const isoDate = toISODate(saleDate);
//     const priceNum = parseCurrency(salePrice);

//     saleIndex += 1;

//     const salesObj = {
//       ownership_transfer_date: isoDate,
//       purchase_price_amount: typeof priceNum === "number" ? priceNum : null,
//     };
//     writeJSON(path.join("data", `sales_${saleIndex}.json`), salesObj);

//     // Deed mapping from instrument type
//     let deed_type = null;
//     if (/^WD$/i.test(instrType)) deed_type = "Warranty Deed";
//     else if (/^QD$/i.test(instrType)) deed_type = "Quitclaim Deed";
//     else if (/^FJ$/i.test(instrType)) {
//       // Unknown (Final Judgment?). Not in enum; emit error and leave null
//       errors.push({
//         type: "error",
//         message: `Unknown enum value ${instrType}.`,
//         path: "deed.deed_type",
//       });
//     } else if (instrType) {
//       errors.push({
//         type: "error",
//         message: `Unknown enum value ${instrType}.`,
//         path: "deed.deed_type",
//       });
//     }
//     const deedObj = { deed_type: deed_type || null };
//     writeJSON(path.join("data", `deed_${saleIndex}.json`), deedObj);

//     // File from book/page link (if present)
//     let fileUrl = null;
//     let fileName = null;
//     if (bookEl && bookEl.attr("href") && pageEl && pageEl.text()) {
//       fileUrl = bookEl.attr("href");
//       fileName = `OR Book ${bookEl.text().trim()} Page ${pageEl.text().trim()}`;
//     }
//     let document_type = "ConveyanceDeed";
//     if (deed_type === "Warranty Deed")
//       document_type = "ConveyanceDeedWarrantyDeed";
//     else if (deed_type === "Quitclaim Deed")
//       document_type = "ConveyanceDeedQuitClaimDeed";

//     const fileObj = {
//       file_format: null,
//       name: fileName || null,
//       original_url: fileUrl || null,
//       ipfs_url: null,
//       document_type,
//     };
//     writeJSON(path.join("data", `file_${saleIndex}.json`), fileObj);

//     // Relationships: deed -> file
//     const relDeedFile = {
//       to: { "/": `./deed_${saleIndex}.json` },
//       from: { "/": `./file_${saleIndex}.json` },
//     };
//     writeJSON(
//       path.join("data", `relationship_deed_file_${saleIndex}.json`),
//       relDeedFile,
//     );

//     // Relationship: sales -> deed
//     const relSalesDeed = {
//       to: { "/": `./sales_${saleIndex}.json` },
//       from: { "/": `./deed_${saleIndex}.json` },
//     };
//     writeJSON(
//       path.join("data", `relationship_sales_deed_${saleIndex}.json`),
//       relSalesDeed,
//     );

//     // Owner relationships using owners_by_date for both persons and companies at that date
//     const ownersForDate = ownersByDate[isoDate] || [];
//     ownersForDate.forEach((o) => {
//       if (o.type === "person") {
//         const key = `${(o.first_name || "").toUpperCase()}|${(o.middle_name || "").toUpperCase()}|${(o.last_name || "").toUpperCase()}`;
//         if (!main.personIndexMap[key]) {
//           main.personCount += 1;
//           const pIdx = main.personCount;
//           main.personIndexMap[key] = pIdx;
//           const personObj = {
//             birth_date: null,
//             first_name: titleCaseName(o.first_name),
//             last_name: titleCaseName(o.last_name),
//             middle_name: o.middle_name ? titleCaseName(o.middle_name) : null,
//             prefix_name: null,
//             suffix_name: null,
//             us_citizenship_status: null,
//             veteran_status: null,
//           };
//           writeJSON(path.join("data", `person_${pIdx}.json`), personObj);
//         }
//         const pFileIdx = main.personIndexMap[key];
//         const relSalesPerson = {
//           to: { "/": `./person_${pFileIdx}.json` },
//           from: { "/": `./sales_${saleIndex}.json` },
//         };
//         main.relSalesPersonCount += 1;
//         writeJSON(
//           path.join(
//             "data",
//             `relationship_sales_person_${main.relSalesPersonCount}.json`,
//           ),
//           relSalesPerson,
//         );
//       } else if (o.type === "company") {
//         const ckey = (o.name || "").toUpperCase();
//         if (!main.companyIndexMap[ckey]) {
//           main.companyCount += 1;
//           const cIdx = main.companyCount;
//           main.companyIndexMap[ckey] = cIdx;
//           const companyObj = { name: o.name || null };
//           writeJSON(path.join("data", `company_${cIdx}.json`), companyObj);
//         }
//         const cFileIdx = main.companyIndexMap[ckey];
//         const relSalesCompany = {
//           to: { "/": `./company_${cFileIdx}.json` },
//           from: { "/": `./sales_${saleIndex}.json` },
//         };
//         main.relSalesCompanyCount += 1;
//         writeJSON(
//           path.join(
//             "data",
//             `relationship_sales_company_${main.relSalesCompanyCount}.json`,
//           ),
//           relSalesCompany,
//         );
//       }
//     });
//   });

//   // UTILITIES
//   const utilKey = `property_${parcelId}`;
//   const utilSrc = (utilitiesData || {})[utilKey] || null;
//   if (utilSrc) {
//     const utilOut = {
//       cooling_system_type: utilSrc.cooling_system_type ?? null,
//       heating_system_type: utilSrc.heating_system_type ?? null,
//       public_utility_type: utilSrc.public_utility_type ?? null,
//       sewer_type: utilSrc.sewer_type ?? null,
//       water_source_type: utilSrc.water_source_type ?? null,
//       plumbing_system_type: utilSrc.plumbing_system_type ?? null,
//       plumbing_system_type_other_description:
//         utilSrc.plumbing_system_type_other_description ?? null,
//       electrical_panel_capacity: utilSrc.electrical_panel_capacity ?? null,
//       electrical_wiring_type: utilSrc.electrical_wiring_type ?? null,
//       hvac_condensing_unit_present:
//         utilSrc.hvac_condensing_unit_present ?? null,
//       electrical_wiring_type_other_description:
//         utilSrc.electrical_wiring_type_other_description ?? null,
//       solar_panel_present: utilSrc.solar_panel_present ?? false,
//       solar_panel_type: utilSrc.solar_panel_type ?? null,
//       solar_panel_type_other_description:
//         utilSrc.solar_panel_type_other_description ?? null,
//       smart_home_features: utilSrc.smart_home_features ?? null,
//       smart_home_features_other_description:
//         utilSrc.smart_home_features_other_description ?? null,
//       hvac_unit_condition: utilSrc.hvac_unit_condition ?? null,
//       solar_inverter_visible: utilSrc.solar_inverter_visible ?? false,
//       hvac_unit_issues: utilSrc.hvac_unit_issues ?? null,
//       electrical_panel_installation_date:
//         utilSrc.electrical_panel_installation_date ?? null,
//       electrical_rewire_date: utilSrc.electrical_rewire_date ?? null,
//       hvac_capacity_kw: utilSrc.hvac_capacity_kw ?? null,
//       hvac_capacity_tons: utilSrc.hvac_capacity_tons ?? null,
//       hvac_equipment_component: utilSrc.hvac_equipment_component ?? null,
//       hvac_equipment_manufacturer: utilSrc.hvac_equipment_manufacturer ?? null,
//       hvac_equipment_model: utilSrc.hvac_equipment_model ?? null,
//       hvac_installation_date: utilSrc.hvac_installation_date ?? null,
//       hvac_seer_rating: utilSrc.hvac_seer_rating ?? null,
//       hvac_system_configuration: utilSrc.hvac_system_configuration ?? null,
//       plumbing_system_installation_date:
//         utilSrc.plumbing_system_installation_date ?? null,
//       sewer_connection_date: utilSrc.sewer_connection_date ?? null,
//       solar_installation_date: utilSrc.solar_installation_date ?? null,
//       solar_inverter_installation_date:
//         utilSrc.solar_inverter_installation_date ?? null,
//       solar_inverter_manufacturer: utilSrc.solar_inverter_manufacturer ?? null,
//       solar_inverter_model: utilSrc.solar_inverter_model ?? null,
//       water_connection_date: utilSrc.water_connection_date ?? null,
//       water_heater_installation_date:
//         utilSrc.water_heater_installation_date ?? null,
//       water_heater_manufacturer: utilSrc.water_heater_manufacturer ?? null,
//       water_heater_model: utilSrc.water_heater_model ?? null,
//       well_installation_date: utilSrc.well_installation_date ?? null,
//     };
//     writeJSON(path.join("data", "utility.json"), utilOut);
//   }

//   // LAYOUTS
//   const layoutKey = `property_${parcelId}`;
//   const layoutSrc = (layoutData || {})[layoutKey] || null;
//   if (layoutSrc && Array.isArray(layoutSrc.layouts)) {
//     layoutSrc.layouts.forEach((l, idx) => {
//       const layoutOut = {
//         space_type: l.space_type ?? null,
//         space_index: l.space_index ?? null,
//         flooring_material_type: l.flooring_material_type ?? null,
//         size_square_feet: l.size_square_feet ?? null,
//         floor_level: l.floor_level ?? null,
//         has_windows: l.has_windows ?? null,
//         window_design_type: l.window_design_type ?? null,
//         window_material_type: l.window_material_type ?? null,
//         window_treatment_type: l.window_treatment_type ?? null,
//         is_finished: l.is_finished ?? false,
//         furnished: l.furnished ?? null,
//         paint_condition: l.paint_condition ?? null,
//         flooring_wear: l.flooring_wear ?? null,
//         clutter_level: l.clutter_level ?? null,
//         visible_damage: l.visible_damage ?? null,
//         countertop_material: l.countertop_material ?? null,
//         cabinet_style: l.cabinet_style ?? null,
//         fixture_finish_quality: l.fixture_finish_quality ?? null,
//         design_style: l.design_style ?? null,
//         natural_light_quality: l.natural_light_quality ?? null,
//         decor_elements: l.decor_elements ?? null,
//         pool_type: l.pool_type ?? null,
//         pool_equipment: l.pool_equipment ?? null,
//         spa_type: l.spa_type ?? null,
//         safety_features: l.safety_features ?? null,
//         view_type: l.view_type ?? null,
//         lighting_features: l.lighting_features ?? null,
//         condition_issues: l.condition_issues ?? null,
//         is_exterior: l.is_exterior ?? false,
//         pool_condition: l.pool_condition ?? null,
//         pool_surface_type: l.pool_surface_type ?? null,
//         pool_water_quality: l.pool_water_quality ?? null,
//         bathroom_renovation_date: l.bathroom_renovation_date ?? null,
//         kitchen_renovation_date: l.kitchen_renovation_date ?? null,
//         flooring_installation_date: l.flooring_installation_date ?? null,
//       };
//       writeJSON(path.join("data", `layout_${idx + 1}.json`), layoutOut);
//     });
//   }

//   // LOT
//   const lot = {
//     lot_type: null,
//     lot_length_feet: null,
//     lot_width_feet: null,
//     lot_area_sqft: null,
//     landscaping_features: null,
//     view: null,
//     fencing_type: null,
//     fence_height: null,
//     fence_length: null,
//     driveway_material: null,
//     driveway_condition: null,
//     lot_condition_issues: null,
//     lot_size_acre: typeof lotSizeAcre === "number" ? lotSizeAcre : null,
//   };
//   writeJSON(path.join("data", "lot.json"), lot);

//   // STRUCTURE
//   const extWall = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl06_pnlSingleValue span",
//   );
//   const roofStructure = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl07_pnlSingleValue span",
//   );
//   const roofCover = extractText(
//     $,
//     "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_rptrDynamicColumns_ctl00_pnlSingleValue span",
//   );

//   function mapExteriorWall(val) {
//     if (!val) return null;
//     const v = val.toUpperCase();
//     if (v.includes("HARDIE")) return "Fiber Cement Siding";
//     if (v.includes("STUCCO")) return "Stucco";
//     if (v.includes("BRICK")) return "Brick";
//     return null;
//   }
//   function mapRoofDesign(val) {
//     if (!val) return null;
//     const v = val.toUpperCase();
//     if (v.includes("GABLE") && v.includes("HIP")) return "Combination";
//     if (v.includes("GABLE")) return "Gable";
//     if (v.includes("HIP")) return "Hip";
//     if (v.includes("FLAT")) return "Flat";
//     return null;
//   }
//   function mapRoofMaterialType(val) {
//     if (!val) return null;
//     const v = val.toUpperCase();
//     if (v.includes("METAL")) return "Metal";
//     if (v.includes("TILE")) return "CeramicTile";
//     if (v.includes("SHINGLE")) return "Shingle";
//     return null;
//   }

//   const structure = {
//     architectural_style_type: null,
//     attachment_type: null,
//     exterior_wall_material_primary: mapExteriorWall(extWall),
//     exterior_wall_material_secondary: null,
//     exterior_wall_condition: null,
//     exterior_wall_insulation_type: null,
//     flooring_material_primary: null,
//     flooring_material_secondary: null,
//     subfloor_material: null,
//     flooring_condition: null,
//     interior_wall_structure_material: null,
//     interior_wall_surface_material_primary: null,
//     interior_wall_surface_material_secondary: null,
//     interior_wall_finish_primary: null,
//     interior_wall_finish_secondary: null,
//     interior_wall_condition: null,
//     roof_covering_material: null,
//     roof_underlayment_type: null,
//     roof_structure_material: null,
//     roof_design_type: mapRoofDesign(roofStructure),
//     roof_condition: null,
//     roof_age_years: null,
//     gutters_material: null,
//     gutters_condition: null,
//     roof_material_type: mapRoofMaterialType(roofCover),
//     foundation_type: null,
//     foundation_material: null,
//     foundation_waterproofing: null,
//     foundation_condition: null,
//     ceiling_structure_material: null,
//     ceiling_surface_material: null,
//     ceiling_insulation_type: null,
//     ceiling_height_average: null,
//     ceiling_condition: null,
//     exterior_door_material: null,
//     interior_door_material: null,
//     window_frame_material: null,
//     window_glazing_type: null,
//     window_operation_type: null,
//     window_screen_material: null,
//     primary_framing_material: null,
//     secondary_framing_material: null,
//     structural_damage_indicators: null,

//     exterior_wall_condition_primary: null,
//     exterior_wall_condition_secondary: null,
//     exterior_wall_insulation_type_primary: null,
//     exterior_wall_insulation_type_secondary: null,
//     finished_base_area: conditionedArea ? Number(conditionedArea) : null,
//     finished_basement_area: null,
//     finished_upper_story_area: null,
//     foundation_repair_date: null,
//     number_of_stories: null,
//     roof_date: null,
//     siding_installation_date: null,
//     window_installation_date: null,
//     exterior_door_installation_date: null,
//   };
//   writeJSON(path.join("data", "structure.json"), structure);

//   // Emit errors for unknown enums
//   errors.forEach((e) => {
//     console.error(JSON.stringify(e));
//   });
// }

// // shared counters for owner files and relationships
// main.personIndexMap = {};
// main.personCount = 0;
// main.relSalesPersonCount = 0;
// main.companyIndexMap = {};
// main.companyCount = 0;
// main.relSalesCompanyCount = 0;

// main();
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function cleanDir(p) {
  if (!fs.existsSync(p)) return;
  const entries = fs.readdirSync(p);
  for (const f of entries) {
    const fp = path.join(p, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      cleanDir(fp);
      fs.rmdirSync(fp);
    } else {
      fs.unlinkSync(fp);
    }
  }
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrency(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  if (s === "" || isNaN(Number(s))) return null;
  return Number(Number(s).toFixed(2));
}

function toISODate(mdyyyy) {
  if (!mdyyyy) return null;
  const m = String(mdyyyy).trim();
  const parts = m.split(/[\/-]/);
  if (parts.length !== 3) return null;
  let [mm, dd, yyyy] = parts;
  if (yyyy.length === 2) yyyy = (Number(yyyy) < 50 ? "20" : "19") + yyyy;
  const pad = (n) => String(n).padStart(2, "0");
  return `${yyyy}-${pad(mm)}-${pad(dd)}`;
}

function titleCaseName(s) {
  if (!s) return null;
  return s
    .toLowerCase()
    .split(/\s|\-|\'|\./)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractText($, sel) {
  const el = $(sel);
  if (!el || el.length === 0) return null;
  return el.text().trim() || null;
}

function parseSecTwpRng(str) {
  if (!str) return { section: null, township: null, range: null };
  const m = String(str)
    .trim()
    .match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return { section: null, township: null, range: null };
  return { section: m[1], township: m[2], range: m[3] };
}

function parseAddressFromFull(full) {
  if (!full) return {};
  const out = {
    street_number: null,
    street_pre_directional_text: null,
    street_name: null,
    street_suffix_type: null,
    street_post_directional_text: null,
    city_name: null,
    state_code: null,
    postal_code: null,
    plus_four_postal_code: null,
  };
  try {
    const mainParts = full.split(",");
    const line1 = (mainParts[0] || "").trim();
    const city = (mainParts[1] || "").trim();
    const stateZip = (mainParts[2] || "").trim();

    const tokens = line1.split(/\s+/);
    if (tokens.length >= 2) {
      out.street_number = tokens[0];
      const pre = tokens[1].toUpperCase();
      const preSet = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
      if (preSet.has(pre)) {
        out.street_pre_directional_text = pre;
        const rest = tokens.slice(2);
        if (rest.length > 0) {
          const last = rest[rest.length - 1];
          const suffixMap = {
            AVE: "Ave",
            AVENUE: "Ave",
            RD: "Rd",
            ROAD: "Rd",
            ST: "St",
            STREET: "St",
            DR: "Dr",
            DRIVE: "Dr",
            LN: "Ln",
            LANE: "Ln",
            BLVD: "Blvd",
            HWY: "Hwy",
            CT: "Ct",
            COURT: "Ct",
            TER: "Ter",
            TERRACE: "Ter",
            PL: "Pl",
            PLACE: "Pl",
            WAY: "Way",
            PKWY: "Pkwy",
            CIR: "Cir",
            CIRCLE: "Cir",
          };
          const sufNorm = suffixMap[last.toUpperCase()];
          if (sufNorm) {
            out.street_suffix_type = sufNorm;
            const nameTokens = rest.slice(0, -1);
            out.street_name = nameTokens.join(" ").trim() || null;
          } else {
            out.street_name = rest.join(" ").trim() || null;
          }
        }
      } else {
        const rest = tokens.slice(1);
        if (rest.length > 0) {
          const last = rest[rest.length - 1];
          const suffixMap = {
            AVE: "Ave",
            AVENUE: "Ave",
            RD: "Rd",
            ROAD: "Rd",
            ST: "St",
            STREET: "St",
            DR: "Dr",
            DRIVE: "Dr",
            LN: "Ln",
            LANE: "Ln",
            BLVD: "Blvd",
            HWY: "Hwy",
            CT: "Ct",
            COURT: "Ct",
            TER: "Ter",
            TERRACE: "Ter",
            PL: "Pl",
            PLACE: "Pl",
            WAY: "Way",
            PKWY: "Pkwy",
            CIR: "Cir",
            CIRCLE: "Cir",
          };
          const sufNorm = suffixMap[last.toUpperCase()];
          if (sufNorm) {
            out.street_suffix_type = sufNorm;
            const nameTokens = rest.slice(0, -1);
            out.street_name = nameTokens.join(" ").trim() || null;
          } else {
            out.street_name = rest.join(" ").trim() || null;
          }
        }
      }
    }

    out.city_name = city ? city.toUpperCase() : null;
    const m = stateZip.match(/([A-Z]{2})\s*(\d{5})(?:-(\d{4}))?/);
    if (m) {
      out.state_code = m[1];
      out.postal_code = m[2];
      out.plus_four_postal_code = m[3] || null;
    }
  } catch (e) {}
  return out;
}

function main() {
  ensureDir("data");
  cleanDir("data");

  const htmlPath = "input.html";
  const addrPath = "unnormalized_address.json";
  const seedPath = "property_seed.json";
  const ownersPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);

  const seed = readJSON(seedPath) || {};
  const addrRaw = readJSON(addrPath) || {};
  const ownerData = readJSON(ownersPath) || {};
  const utilitiesData = readJSON(utilitiesPath) || {};
  const layoutData = readJSON(layoutPath) || {};

  const parcelId =
    seed.parcel_id || extractText($, "#ctlBodyPane_ctl02_ctl01_lblParcelID");

  // PROPERTY
  const legalDesc = extractText(
    $,
    "#ctlBodyPane_ctl02_ctl01_lblLegalDescription",
  );
  const subdivision = extractText($, "#ctlBodyPane_ctl02_ctl01_lblSubdivision");
  const secTwpRng = extractText($, "#ctlBodyPane_ctl02_ctl01_lblSecTwpRng");
  const propUseCode = extractText($, "#ctlBodyPane_ctl02_ctl01_lblUsage") || "";

  // Lot acreage
  const acreageStr = extractText($, "#ctlBodyPane_ctl02_ctl01_lblGrossAcres");
  const lotSizeAcre = acreageStr ? parseFloat(acreageStr) : null;

  // Building info
  const actualArea = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl01_pnlSingleValue span",
  );
  const conditionedArea = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl02_pnlSingleValue span",
  );
  const actualYearBuilt = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl03_pnlSingleValue span",
  );
  const effectiveYearBuilt = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl04_pnlSingleValue span",
  );

  let property_type = null;
  let number_of_units_type = null;
  let number_of_units = null;

  // Define residential codes
  const residentialCodes = new Set([
    "0000", "0100", "0101", "0102", "0103", "0104", "0105", "0120", "0125",
    "0130", "0135", "0199", "0200", "0201", "0202", "0211", "0220", "0299",
    "0400", "0800", "0801", "0802", "0820", "0830", "0840", "MHPK", "SPR001",
    "SSP001", "WSP001"
  ]);

  const propCodePrefix = propUseCode.split(" ")[0];

  if (residentialCodes.has(propCodePrefix)) {
    // Map residential codes
    switch (propCodePrefix) {
      case "0000": // VACANT RESIDENTIAL
        property_type = "VacantLand";
        break;
      case "0100":
      case "0101": // SINGLE FAMILY HOMES
      case "0104": // EXTENSION OF PRIMARY RESIDENCE
      case "0105": // BARNDOMINIUM
      case "0120": // CEDAR KEY - SINGLE FAMILY (DOW
      case "0125": // SF OLD CK STILT
      case "0130": // CEDAR KEY - SINGLE FAMILY
      case "0135": // CEDAR KEY - SINGLE FAMILY (STI
      case "0199": // SINGLE FAM RES
      case "0201": // SINGLE FAMILY HOMES (from mobile home section)
        property_type = "SingleFamily";
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0102": // MH/HSE
        property_type = "ManufacturedHousing";
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0103": // SINGLE FAMILY MODULAR
        property_type = "Modular";
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0200": // MOBILE HOME
      case "0211": // MOBILE HOME NOT LANDOWNERS
      case "0220": // CEDAR KEY - MOBILE HOME
      case "0299": // MOBILE FAMILY
      case "MHPK": // MOBILE HOME PARK
        property_type = "MobileHome";
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0202": // MH - ADU Accessory Dwelling Unit Residential
        property_type = "SingleFamily"; // Assuming ADU is part of a single family property
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0400": // CONDO
        property_type = "Condominium";
        number_of_units_type = "One";
        number_of_units = 1;
        break;
      case "0800":
      case "0801":
      case "0802": // MULTI-FAMILY (general, assume 2-4)
        property_type = "MultipleFamily";
        number_of_units_type = "TwoToFour";
        number_of_units = 2; // Default to 2 for range
        break;
      case "0820": // RES DUPLEX
        property_type = "Duplex";
        number_of_units_type = "Two";
        number_of_units = 2;
        break;
      case "0830": // RES TRIPLEX
        property_type = "3Units";
        number_of_units_type = "Three";
        number_of_units = 3;
        break;
      case "0840": // RES QUADPLEX
        property_type = "4Units";
        number_of_units_type = "Four";
        number_of_units = 4;
        break;
      case "SPR001": // GSG - XFT Special Residential
      case "SSP001": // GSG - XFT Septic Tanks Residential
      case "WSP001": // GSG - XFT Well and Septic Residential
        property_type = "MiscellaneousResidential";
        break;
      default:
        property_type = "MiscellaneousResidential"; // Fallback for any other residential code
        break;
    }
  } else {
    // All other codes are mapped to Commercial or Industrial
    // We'll simplify this to just "Commercial" for all non-residential,
    // as per the instruction to avoid "Industrial" as a distinct type in the schema.
    // If the schema allowed "Industrial", we would differentiate.
    property_type = "Commercial";
    number_of_units_type = null;
    number_of_units = null;
  }


  const property = {
    parcel_identifier: parcelId || "",
    property_legal_description_text: legalDesc || null,
    property_structure_built_year: actualYearBuilt
      ? Number(actualYearBuilt)
      : null,
    property_effective_built_year: effectiveYearBuilt
      ? Number(effectiveYearBuilt)
      : null,
    property_type,
    number_of_units_type,
    number_of_units,
    subdivision: subdivision || null,
    livable_floor_area: conditionedArea ? String(conditionedArea) : null,
    area_under_air: conditionedArea ? String(conditionedArea) : null,
    total_area: actualArea ? String(actualArea) : null,
    zoning: null,
    historic_designation: undefined,
    request_identifier: parcelId || "unknown", // Assuming parcelId can be used as request_identifier
    source_http_request: {
      method: "GET",
      url: "https://www.levy-pa.com/property-details.asp?parcelid=" + parcelId, // Example URL, adjust as needed
    },
  };
  writeJSON(path.join("data", "property.json"), property);

  // ADDRESS
  const fullAddr =
    addrRaw.full_address ||
    extractText($, "#ctlBodyPane_ctl02_ctl01_lblPropertyAddress");
  const addrParts = parseAddressFromFull(fullAddr);
  const { section, township, range } = parseSecTwpRng(secTwpRng);

  if (addrParts.street_name) {
    const dirRegex = /\b(E|N|NE|NW|S|SE|SW|W)\b/i;
    if (dirRegex.test(addrParts.street_name)) {
      addrParts.street_name = addrParts.street_name
        .replace(dirRegex, "")
        .trim();
      if (addrParts.street_name === "") addrParts.street_name = null;
    }
  }

  const address = {
    street_number: addrParts.street_number || null,
    street_pre_directional_text: addrParts.street_pre_directional_text || null,
    street_name: addrParts.street_name || null,
    street_suffix_type: addrParts.street_suffix_type || null,
    street_post_directional_text: null,
    city_name: addrParts.city_name || null,
    state_code: addrParts.state_code || null,
    postal_code: addrParts.postal_code || null,
    plus_four_postal_code: addrParts.plus_four_postal_code || null,
    country_code: "US",
    county_name: "Levy",
    municipality_name: null,
    unit_identifier: null,
    route_number: null,
    lot: null,
    block: null,
    longitude: null,
    latitude: null,
    section: section || null,
    township: township || null,
    range: range || null,
  };
  writeJSON(path.join("data", "address.json"), address);

  // TAX (2025 Preliminary Value Summary)
  const taxYearHeader = extractText(
    $,
    "#ctlBodyPane_ctl06_ctl01_grdValuation thead th.value-column",
  );
  let taxYear = null;
  if (taxYearHeader) {
    const m = taxYearHeader.match(/(\d{4})/);
    if (m) taxYear = Number(m[1]);
  }
  function getValuationRow(label) {
    const rows = $("#ctlBodyPane_ctl06_ctl01_grdValuation tbody tr");
    let val = null;
    rows.each((i, tr) => {
      const th = $(tr).find("th").text().trim();
      const td = $(tr).find("td.value-column").text().trim();
      if (th.toLowerCase() === label.toLowerCase()) {
        val = parseCurrency(td);
      }
    });
    return val;
  }
  if (taxYear) {
    const property_building_amount = getValuationRow("Building Value");
    const property_land_amount = getValuationRow("Market Land Value");
    const property_market_value_amount = getValuationRow("Just (Market) Value");
    const property_assessed_value_amount = getValuationRow("Assessed Value");
    const property_taxable_value_amount = getValuationRow("Taxable Value");

    const tax = {
      tax_year: taxYear,
      property_assessed_value_amount,
      property_market_value_amount,
      property_building_amount,
      property_land_amount,
      property_taxable_value_amount,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    writeJSON(path.join("data", `tax_${taxYear}.json`), tax);
  }

  // SALES, DEEDS, FILES, RELATIONSHIPS
  const salesRows = $("#ctlBodyPane_ctl11_ctl01_grdSales tbody tr");
  const errors = [];

  // owner mapping by date
  const ownersByDate =
    ((ownerData || {}).property_1664800000 || {}).owners_by_date || {};

  let saleIndex = 0;
  salesRows.each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 9) return;
    const saleDate = $(tds[0]).text().trim();
    const salePrice = $(tds[1]).text().trim();
    const instrType = $(tds[2]).text().trim();
    const bookEl = $(tds[3]).find("a");
    const pageEl = $(tds[4]).find("a");

    const isoDate = toISODate(saleDate);
    const priceNum = parseCurrency(salePrice);

    saleIndex += 1;

    const salesObj = {
      ownership_transfer_date: isoDate,
      purchase_price_amount: typeof priceNum === "number" ? priceNum : null,
    };
    writeJSON(path.join("data", `sales_${saleIndex}.json`), salesObj);

    // Deed mapping from instrument type
    let deed_type = null;
    if (/^WD$/i.test(instrType)) deed_type = "Warranty Deed";
    else if (/^QD$/i.test(instrType)) deed_type = "Quitclaim Deed";
    else if (/^FJ$/i.test(instrType)) {
      // Unknown (Final Judgment?). Not in enum; emit error and leave null
      errors.push({
        type: "error",
        message: `Unknown enum value ${instrType}.`,
        path: "deed.deed_type",
      });
    } else if (instrType) {
      errors.push({
        type: "error",
        message: `Unknown enum value ${instrType}.`,
        path: "deed.deed_type",
      });
    }
    const deedObj = { deed_type: deed_type || null };
    writeJSON(path.join("data", `deed_${saleIndex}.json`), deedObj);

    // File from book/page link (if present)
    let fileUrl = null;
    let fileName = null;
    if (bookEl && bookEl.attr("href") && pageEl && pageEl.text()) {
      fileUrl = bookEl.attr("href");
      fileName = `OR Book ${bookEl.text().trim()} Page ${pageEl.text().trim()}`;
    }
    let document_type = "ConveyanceDeed";
    if (deed_type === "Warranty Deed")
      document_type = "ConveyanceDeedWarrantyDeed";
    else if (deed_type === "Quitclaim Deed")
      document_type = "ConveyanceDeedQuitClaimDeed";

    const fileObj = {
      file_format: null,
      name: fileName || null,
      original_url: fileUrl || null,
      ipfs_url: null,
      document_type,
    };
    writeJSON(path.join("data", `file_${saleIndex}.json`), fileObj);

    // Relationships: deed -> file
    const relDeedFile = {
      to: { "/": `./deed_${saleIndex}.json` },
      from: { "/": `./file_${saleIndex}.json` },
    };
    writeJSON(
      path.join("data", `relationship_deed_file_${saleIndex}.json`),
      relDeedFile,
    );

    // Relationship: sales -> deed
    const relSalesDeed = {
      to: { "/": `./sales_${saleIndex}.json` },
      from: { "/": `./deed_${saleIndex}.json` },
    };
    writeJSON(
      path.join("data", `relationship_sales_deed_${saleIndex}.json`),
      relSalesDeed,
    );

    // Owner relationships using owners_by_date for both persons and companies at that date
    const ownersForDate = ownersByDate[isoDate] || [];
    ownersForDate.forEach((o) => {
      if (o.type === "person") {
        const key = `${(o.first_name || "").toUpperCase()}|${(o.middle_name || "").toUpperCase()}|${(o.last_name || "").toUpperCase()}`;
        if (!main.personIndexMap[key]) {
          main.personCount += 1;
          const pIdx = main.personCount;
          main.personIndexMap[key] = pIdx;
          const personObj = {
            birth_date: null,
            first_name: titleCaseName(o.first_name),
            last_name: titleCaseName(o.last_name),
            middle_name: o.middle_name ? titleCaseName(o.middle_name) : null,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          };
          writeJSON(path.join("data", `person_${pIdx}.json`), personObj);
        }
        const pFileIdx = main.personIndexMap[key];
        const relSalesPerson = {
          to: { "/": `./person_${pFileIdx}.json` },
          from: { "/": `./sales_${saleIndex}.json` },
        };
        main.relSalesPersonCount += 1;
        writeJSON(
          path.join(
            "data",
            `relationship_sales_person_${main.relSalesPersonCount}.json`,
          ),
          relSalesPerson,
        );
      } else if (o.type === "company") {
        const ckey = (o.name || "").toUpperCase();
        if (!main.companyIndexMap[ckey]) {
          main.companyCount += 1;
          const cIdx = main.companyCount;
          main.companyIndexMap[ckey] = cIdx;
          const companyObj = { name: o.name || null };
          writeJSON(path.join("data", `company_${cIdx}.json`), companyObj);
        }
        const cFileIdx = main.companyIndexMap[ckey];
        const relSalesCompany = {
          to: { "/": `./company_${cFileIdx}.json` },
          from: { "/": `./sales_${saleIndex}.json` },
        };
        main.relSalesCompanyCount += 1;
        writeJSON(
          path.join(
            "data",
            `relationship_sales_company_${main.relSalesCompanyCount}.json`,
          ),
          relSalesCompany,
        );
      }
    });
  });

  // UTILITIES
  const utilKey = `property_${parcelId}`;
  const utilSrc = (utilitiesData || {})[utilKey] || null;
  if (utilSrc) {
    const utilOut = {
      cooling_system_type: utilSrc.cooling_system_type ?? null,
      heating_system_type: utilSrc.heating_system_type ?? null,
      public_utility_type: utilSrc.public_utility_type ?? null,
      sewer_type: utilSrc.sewer_type ?? null,
      water_source_type: utilSrc.water_source_type ?? null,
      plumbing_system_type: utilSrc.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        utilSrc.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: utilSrc.electrical_panel_capacity ?? null,
      electrical_wiring_type: utilSrc.electrical_wiring_type ?? null,
      hvac_condensing_unit_present:
        utilSrc.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        utilSrc.electrical_wiring_type_other_description ?? null,
      solar_panel_present: utilSrc.solar_panel_present ?? false,
      solar_panel_type: utilSrc.solar_panel_type ?? null,
      solar_panel_type_other_description:
        utilSrc.solar_panel_type_other_description ?? null,
      smart_home_features: utilSrc.smart_home_features ?? null,
      smart_home_features_other_description:
        utilSrc.smart_home_features_other_description ?? null,
      hvac_unit_condition: utilSrc.hvac_unit_condition ?? null,
      solar_inverter_visible: utilSrc.solar_inverter_visible ?? false,
      hvac_unit_issues: utilSrc.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        utilSrc.electrical_panel_installation_date ?? null,
      electrical_rewire_date: utilSrc.electrical_rewire_date ?? null,
      hvac_capacity_kw: utilSrc.hvac_capacity_kw ?? null,
      hvac_capacity_tons: utilSrc.hvac_capacity_tons ?? null,
      hvac_equipment_component: utilSrc.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: utilSrc.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: utilSrc.hvac_equipment_model ?? null,
      hvac_installation_date: utilSrc.hvac_installation_date ?? null,
      hvac_seer_rating: utilSrc.hvac_seer_rating ?? null,
      hvac_system_configuration: utilSrc.hvac_system_configuration ?? null,
      plumbing_system_installation_date:
        utilSrc.plumbing_system_installation_date ?? null,
      sewer_connection_date: utilSrc.sewer_connection_date ?? null,
      solar_installation_date: utilSrc.solar_installation_date ?? null,
      solar_inverter_installation_date:
        utilSrc.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: utilSrc.solar_inverter_manufacturer ?? null,
      solar_inverter_model: utilSrc.solar_inverter_model ?? null,
      water_connection_date: utilSrc.water_connection_date ?? null,
      water_heater_installation_date:
        utilSrc.water_heater_installation_date ?? null,
      water_heater_manufacturer: utilSrc.water_heater_manufacturer ?? null,
      water_heater_model: utilSrc.water_heater_model ?? null,
      well_installation_date: utilSrc.well_installation_date ?? null,
    };
    writeJSON(path.join("data", "utility.json"), utilOut);
  }

  // LAYOUTS
  const layoutKey = `property_${parcelId}`;
  const layoutSrc = (layoutData || {})[layoutKey] || null;
  if (layoutSrc && Array.isArray(layoutSrc.layouts)) {
    layoutSrc.layouts.forEach((l, idx) => {
      const layoutOut = {
        space_type: l.space_type ?? null,
        space_index: l.space_index ?? null,
        flooring_material_type: l.flooring_material_type ?? null,
        size_square_feet: l.size_square_feet ?? null,
        floor_level: l.floor_level ?? null,
        has_windows: l.has_windows ?? null,
        window_design_type: l.window_design_type ?? null,
        window_material_type: l.window_material_type ?? null,
        window_treatment_type: l.window_treatment_type ?? null,
        is_finished: l.is_finished ?? false,
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
      writeJSON(path.join("data", `layout_${idx + 1}.json`), layoutOut);
    });
  }

  // LOT
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
    lot_size_acre: typeof lotSizeAcre === "number" ? lotSizeAcre : null,
  };
  writeJSON(path.join("data", "lot.json"), lot);

  // STRUCTURE
  const extWall = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl06_pnlSingleValue span",
  );
  const roofStructure = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataLeftColumn_rptrDynamicColumns_ctl07_pnlSingleValue span",
  );
  const roofCover = extractText(
    $,
    "#ctlBodyPane_ctl08_ctl01_lstBuildings_ctl00_dynamicBuildingDataRightColumn_rptrDynamicColumns_ctl00_pnlSingleValue span",
  );

  function mapExteriorWall(val) {
    if (!val) return null;
    const v = val.toUpperCase();
    if (v.includes("HARDIE")) return "Fiber Cement Siding";
    if (v.includes("STUCCO")) return "Stucco";
    if (v.includes("BRICK")) return "Brick";
    return null;
  }
  function mapRoofDesign(val) {
    if (!val) return null;
    const v = val.toUpperCase();
    if (v.includes("GABLE") && v.includes("HIP")) return "Combination";
    if (v.includes("GABLE")) return "Gable";
    if (v.includes("HIP")) return "Hip";
    if (v.includes("FLAT")) return "Flat";
    return null;
  }
  function mapRoofMaterialType(val) {
    if (!val) return null;
    const v = val.toUpperCase();
    if (v.includes("METAL")) return "Metal";
    if (v.includes("TILE")) return "CeramicTile";
    if (v.includes("SHINGLE")) return "Shingle";
    return null;
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: mapExteriorWall(extWall),
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
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofStructure),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: mapRoofMaterialType(roofCover),
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

    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    finished_base_area: conditionedArea ? Number(conditionedArea) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    foundation_repair_date: null,
    number_of_stories: null,
    roof_date: null,
    siding_installation_date: null,
    window_installation_date: null,
    exterior_door_installation_date: null,
  };
  writeJSON(path.join("data", "structure.json"), structure);

  // Emit errors for unknown enums
  errors.forEach((e) => {
    console.error(JSON.stringify(e));
  });
}

// shared counters for owner files and relationships
main.personIndexMap = {};
main.personCount = 0;
main.relSalesPersonCount = 0;
main.companyIndexMap = {};
main.companyCount = 0;
main.relSalesCompanyCount = 0;

main();