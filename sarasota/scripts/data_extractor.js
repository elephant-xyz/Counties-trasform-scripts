const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(str) {
  if (!str) return null;
  const num = str.replace(/[^0-9.\-]/g, "");
  if (num === "") return null;
  const n = Number(num);
  return Number.isFinite(n) ? n : null;
}

function extractTextAfterColon($el) {
  const text = $el.clone().children("strong").remove().end().text().trim();
  return text.replace(/^:\s*/, "").trim();
}

function cleanOldTaxFiles(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    if (/^tax_\d{4}\.json$/i.test(f)) {
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {}
    }
  });
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  cleanOldTaxFiles(dataDir);

  const inputHtmlPath = path.join(".", "input.html");
  const addrPath = path.join(".", "unnormalized_address.json");
  const seedPath = path.join(".", "property_seed.json");
  const ownerDataPath = path.join(".", "owners", "owner_data.json");
  const utilDataPath = path.join(".", "owners", "utilities_data.json");
  const layoutDataPath = path.join(".", "owners", "layout_data.json");

  const html = fs.readFileSync(inputHtmlPath, "utf8");
  const $ = cheerio.load(html);
  const unAddr = readJSON(addrPath) || {};
  const seed = readJSON(seedPath) || {};
  const parcelId = seed.parcel_id || seed.parcelId || seed.parcel || null;

  // Extract property details from HTML
  let situsAddress = null;
  $("ul.resultl").each((i, ul) => {
    const lis = $(ul).find("> li");
    lis.each((j, li) => {
      const t = $(li).text().trim();
      if (/^Situs Address:/i.test(t)) {
        const next = lis.get(j + 1);
        if (next) situsAddress = $(next).text().trim();
      }
    });
  });

  // Parse right column items
  let landAreaSqft = null;
  let municipality = null;
  let subdivision = null;
  let propertyUse = null;
  let zoning = null;
  let secTwpRge = null;
  let parcelDescription = null;
  let totalLivingUnits = null;
  let census = null;
  let status = null;

  $("ul.resultr li").each((i, li) => {
    const label = $(li).find("strong").first().text().trim();
    const rowText = $(li).text().trim();
    if (/^Land Area:/i.test(label)) {
      const text = extractTextAfterColon($(li));
      const match = text.replace(/,/g, "").match(/(\d+)/);
      if (match) landAreaSqft = parseInt(match[1], 10);
    } else if (/^Municipality:/i.test(label)) {
      municipality = extractTextAfterColon($(li)) || null;
    } else if (/^Subdivision:/i.test(label)) {
      subdivision = extractTextAfterColon($(li)) || null;
    } else if (/^Property Use:/i.test(label)) {
      propertyUse = extractTextAfterColon($(li)) || null;
    } else if (/^Zoning:/i.test(label)) {
      zoning = extractTextAfterColon($(li)) || null;
    } else if (/^Sec\/Twp\/Rge:/i.test(label)) {
      secTwpRge = extractTextAfterColon($(li)) || null;
    } else if (/^Census:/i.test(label)) {
      census = extractTextAfterColon($(li)) || null;
    } else if (/^Status/i.test(label)) {
      status = extractTextAfterColon($(li)) || null;
    } else if (/^Total Living Units:/i.test(label)) {
      const num = extractTextAfterColon($(li));
      totalLivingUnits = num && num !== "" ? Number(num) : null;
    } else if (/^Parcel\s*Description:/i.test(rowText)) {
      const html = $(li).html() || "";
      const after = html
        .replace(/^[\s\S]*Parcel\s*Description:\s*/i, "")
        .trim();
      const clean = cheerio.load(`<div>${after}</div>`)("div").text().trim();
      parcelDescription =
        clean ||
        $(li)
          .text()
          .replace(/Parcel\s*Description:/i, "")
          .trim() ||
        parcelDescription;
    }
  });

  // Address parsing from situsAddress
  let street_number = null,
    street_name = null,
    street_suffix_type = null,
    street_pre_directional = null,
    street_post_directional = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    unit_identifier = null;
  if (situsAddress) {
    try {
      const cleaned = situsAddress.replace(/\s+/g, " ").replace(/,\s*,/g, ",");
      const parts = cleaned.split(",");
      if (parts.length >= 3) {
        const streetCityPart = parts[0].trim();
        state_code = (parts[1] || "").trim().replace(/[^A-Z]/g, "") || null;
        postal_code = (parts[2] || "").trim().replace(/[^0-9]/g, "") || null;
        
        // Extract unit/apt/building info first (anything after #, APT, UNIT, etc.)
        let streetPart = streetCityPart;
        let remainingCity = "";
        
        // Look for unit patterns - need to capture complete unit including "242 BLD 2"
        // Updated regex to properly capture unit + BLD + building number
        const unitMatch = streetCityPart.match(/^(.+?)\s+(?:#|APT|UNIT|SUITE|STE)\s*([A-Z0-9\-]+(?:\s+[A-Z0-9\-]+)?)\s+BLD\s+([A-Z0-9\-]+)\s+(.*)$/i);
        if (unitMatch) {
          // Matched pattern with BLD
          streetPart = unitMatch[1].trim();
          unit_identifier = unitMatch[2].trim() + " BLD " + unitMatch[3].trim();
          remainingCity = unitMatch[4] || "";
        } else {
          // Try simpler pattern without BLD
          const simpleUnitMatch = streetCityPart.match(/^(.+?)\s+(?:#|APT|UNIT|SUITE|STE)\s*([A-Z0-9\-]+(?:\s+[A-Z0-9\-]+)?)\s+(.*)$/i);
          if (simpleUnitMatch) {
            streetPart = simpleUnitMatch[1].trim();
            unit_identifier = simpleUnitMatch[2].trim();
            remainingCity = simpleUnitMatch[3] || "";
          }
        }
        
        // Common street suffixes to identify
        const suffixMap = {
          BLVD: "Blvd",
          BOULEVARD: "Blvd",
          RD: "Rd",
          ROAD: "Rd",
          "RD.": "Rd",
          ST: "St",
          STREET: "St",
          AVE: "Ave",
          AVENUE: "Ave",
          WAY: "Way",
          DR: "Dr",
          DRIVE: "Dr",
          LN: "Ln",
          LANE: "Ln",
          CT: "Ct",
          COURT: "Ct",
          PL: "Pl",
          PLACE: "Pl",
          CIR: "Cir",
          CIRCLE: "Cir",
          TER: "Ter",
          TERRACE: "Ter",
          PKWY: "Pkwy",
          PARKWAY: "Pkwy"
        };
        
        // Split the street part into tokens
        const tokens = streetPart.split(" ");
        
        // Try to identify street components by looking for known suffixes
        let suffixIndex = -1;
        for (let i = 1; i < tokens.length; i++) {
          if (suffixMap[tokens[i].toUpperCase()]) {
            suffixIndex = i;
            break;
          }
        }
        
        // Directional indicators
        const directionals = ['E', 'N', 'NE', 'NW', 'S', 'SE', 'SW', 'W'];
        const isDirectional = (str) => directionals.includes(str.toUpperCase());
        
        if (suffixIndex > 0) {
          // Found a street suffix
          street_number = tokens[0] || null;
          let streetTokens = tokens.slice(1, suffixIndex);
          
          // Check for pre-directional (first token after street number)
          if (streetTokens.length > 0 && isDirectional(streetTokens[0])) {
            street_pre_directional = streetTokens[0].toUpperCase();
            streetTokens = streetTokens.slice(1);
          }
          
          // Check for post-directional (last token before suffix)
          if (streetTokens.length > 0 && isDirectional(streetTokens[streetTokens.length - 1])) {
            street_post_directional = streetTokens[streetTokens.length - 1].toUpperCase();
            streetTokens = streetTokens.slice(0, -1);
          }
          
          street_name = streetTokens.join(" ");
          street_suffix_type = suffixMap[tokens[suffixIndex].toUpperCase()];
          
          // Everything after the suffix is the city, plus any remaining city from unit extraction
          let cityFromStreet = tokens.slice(suffixIndex + 1).join(" ");
          if (remainingCity) {
            city_name = (cityFromStreet ? cityFromStreet + " " + remainingCity : remainingCity).toUpperCase();
          } else {
            city_name = cityFromStreet.toUpperCase() || null;
          }
        } else {
          // No clear suffix found - use heuristic
          // If we have remainingCity from unit extraction, use it
          if (remainingCity) {
            city_name = remainingCity.toUpperCase();
            street_number = tokens[0] || null;
            let streetTokens = tokens.slice(1);
            
            // Check for pre-directional
            if (streetTokens.length > 0 && isDirectional(streetTokens[0])) {
              street_pre_directional = streetTokens[0].toUpperCase();
              streetTokens = streetTokens.slice(1);
            }
            
            if (streetTokens.length >= 1) {
              // Last token might be suffix
              const lastToken = streetTokens[streetTokens.length - 1];
              const mappedSuffix = suffixMap[lastToken.toUpperCase()];
              if (mappedSuffix) {
                street_suffix_type = mappedSuffix;
                let nameTokens = streetTokens.slice(0, -1);
                
                // Check for post-directional before suffix
                if (nameTokens.length > 0 && isDirectional(nameTokens[nameTokens.length - 1])) {
                  street_post_directional = nameTokens[nameTokens.length - 1].toUpperCase();
                  nameTokens = nameTokens.slice(0, -1);
                }
                
                street_name = nameTokens.join(" ");
              } else {
                // Not a known suffix, check if last token is post-directional
                if (streetTokens.length > 0 && isDirectional(streetTokens[streetTokens.length - 1])) {
                  street_post_directional = streetTokens[streetTokens.length - 1].toUpperCase();
                  street_name = streetTokens.slice(0, -1).join(" ");
                } else {
                  street_name = streetTokens.join(" ");
                }
              }
            }
          } else {
            // No unit info, use original heuristic
            street_number = tokens[0] || null;
            // Check if last words might be a multi-word city
            // Common pattern: if we have 4+ tokens, last 2 might be city
            if (tokens.length >= 4) {
              // Assume last 2 words are city for now
              city_name = tokens.slice(-2).join(" ").toUpperCase();
              let streetTokens = tokens.slice(1, -2);
              
              // Check for pre-directional
              if (streetTokens.length > 0 && isDirectional(streetTokens[0])) {
                street_pre_directional = streetTokens[0].toUpperCase();
                streetTokens = streetTokens.slice(1);
              }
              
              if (streetTokens.length >= 1) {
                // Last token of street part might be suffix
                const lastToken = streetTokens[streetTokens.length - 1];
                const mappedSuffix = suffixMap[lastToken.toUpperCase()];
                if (mappedSuffix) {
                  street_suffix_type = mappedSuffix;
                  let nameTokens = streetTokens.slice(0, -1);
                  
                  // Check for post-directional before suffix
                  if (nameTokens.length > 0 && isDirectional(nameTokens[nameTokens.length - 1])) {
                    street_post_directional = nameTokens[nameTokens.length - 1].toUpperCase();
                    nameTokens = nameTokens.slice(0, -1);
                  }
                  
                  street_name = nameTokens.join(" ");
                } else {
                  // Not a known suffix, check if last token is post-directional
                  if (streetTokens.length > 0 && isDirectional(streetTokens[streetTokens.length - 1])) {
                    street_post_directional = streetTokens[streetTokens.length - 1].toUpperCase();
                    street_name = streetTokens.slice(0, -1).join(" ");
                  } else {
                    street_name = streetTokens.join(" ");
                  }
                }
              }
            } else {
              // Fewer tokens - simple parsing
              city_name = (tokens[tokens.length - 1] || "").toUpperCase() || null;
              let streetTokens = tokens.slice(1, -1);
              
              // Check for pre-directional
              if (streetTokens.length > 0 && isDirectional(streetTokens[0])) {
                street_pre_directional = streetTokens[0].toUpperCase();
                streetTokens = streetTokens.slice(1);
              }
              
              if (streetTokens.length >= 1) {
                street_suffix_type = streetTokens[streetTokens.length - 1];
                let nameTokens = streetTokens.slice(0, -1);
                
                // Check for post-directional before potential suffix
                if (nameTokens.length > 0 && isDirectional(nameTokens[nameTokens.length - 1])) {
                  street_post_directional = nameTokens[nameTokens.length - 1].toUpperCase();
                  nameTokens = nameTokens.slice(0, -1);
                }
                
                street_name = nameTokens.join(" ");
              }
              // Apply suffix mapping if applicable
              if (street_suffix_type) {
                const upper = street_suffix_type.toUpperCase();
                street_suffix_type = suffixMap[upper] || 
                  street_suffix_type.charAt(0).toUpperCase() + 
                  street_suffix_type.slice(1).toLowerCase();
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  // Property Type mapping based on Property Use code
  const getPropertyType = (propertyUse) => {
    if (!propertyUse) return null;
    
    // Extract the code from the property use string (e.g., "0100" from "0100 - Single Family Detached" or "082Y" from "082Y - Multiple 2 Family Bldgs")
    const codeMatch = propertyUse.match(/^(\d{3,4}[A-Z]?)/);
    if (!codeMatch) return null;

    const code = codeMatch[1];

    // For 3-digit codes with a letter (like "082Y"), prepend '0' to make it 4 digits + letter
    // For 3-digit codes without a letter, prepend '0' to make it 4 digits
    const normalizedCode = /^\d{3}[A-Z]?$/.test(code) ? '0' + code : code;
    
    // Mapping from property use codes to property types
    const propertyTypeMap = {
      "0100": "SingleFamily",
      "0101": "Townhouse",
      "0102": "Townhouse",
      "010X": "SingleFamily",
      
      "0200": "ManufacturedHousing",
      "0002": "MobileHome",
      "2860": "MobileHome",
      
      "0820": "Duplex",
      "082X": "Duplex",
      "082Y": "MultipleFamily",
      "0082Y": "MultipleFamily",  // Handle both normalized and original versions
      
      "0830": "3Units",
      "083X": "3Units",
      "083Y": "3Units",
      
      "0840": "4Units",
      "084X": "4Units",
      
      "0850": "MultipleFamily",
      "0890": "MultipleFamily",
      "089X": "MultipleFamily",
      
      "0310": "MultipleFamily",
      "031X": "MultipleFamily",
      "0320": "MultipleFamily",
      "032X": "MultipleFamily",
      "0350": "MultipleFamily",
      "035X": "MultipleFamily",
      "0390": "MultipleFamily",
      "039L": "MultipleFamily",
      "039X": "MultipleFamily",
      
      "0304": "Condominium",
      "0380": "MultipleFamily",
      
      "0401": "DetachedCondominium",
      "0402": "Duplex",  // CONDO - Duplex or Villa
      "0403": "Condominium",
      "0404": "Condominium",
      "0405": "Condominium",
      "0407": "Condominium",
      "0408": "Condominium",
      "0430": "Timeshare",
      
      "0501": "Cooperative",
      "0502": "Cooperative",
      "0503": "Cooperative",
      "0507": "Cooperative",
      
      "0700": "MiscellaneousResidential",
      "0704": "MiscellaneousResidential",
      
      "0900": "ResidentialCommonElementsAreas",
      
      "0000": "VacantLand",
      "0001": "MiscellaneousResidential",
      "0004": "VacantLand",
      "0005": "VacantLand",
      "0010": "VacantLand",
      "9900": "VacantLand",
      "9904": "VacantLand",
      
      "0810": "MultipleFamily",
      "081X": "MultipleFamily",
      
      "3904": "NonWarrantableCondo",
      
      "0600": "Retirement",
      "0610": "Retirement",
      "7400": "Retirement",
      "7420": "Retirement",
      "7410": "Retirement",
      "7800": "Retirement"
    };
    
    const mappedType = propertyTypeMap[normalizedCode];

    if (!mappedType) {
      console.error(`ERROR: Property type code "${normalizedCode}" (original: "${code}") from Property Use "${propertyUse}" is not supported by our Lexicon. Please add this mapping to the property type configuration.`);
      throw new Error(`Unsupported property type code: ${normalizedCode} from Property Use: ${propertyUse}`);
    }
    
    return mappedType;
  };

  // Sec/Twp/Rge parsing
  let section = null,
    township = null,
    range = null;
  if (secTwpRge) {
    const parts = secTwpRge.split("-").map((s) => s.trim());
    if (parts.length === 3) {
      section = parts[0] || null;
      township = parts[1] || null;
      range = parts[2] || null;
    }
  }

  // Extract building years from Buildings table
  let yearBuilt = null;
  let effYearBuilt = null;
  let grossArea = null;
  let livingArea = null;
  let numberOfStories = null;
  
  const buildingsTable = $("#Buildings");
  if (buildingsTable.length > 0) {
    buildingsTable.find("tbody tr").first().each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 10) {
        yearBuilt = parseInt($(cells[5]).text().trim()) || null;
        effYearBuilt = parseInt($(cells[6]).text().trim()) || null;
        grossArea = parseInt($(cells[7]).text().replace(/,/g, '').trim()) || null;
        livingArea = parseInt($(cells[8]).text().replace(/,/g, '').trim()) || null;
        numberOfStories = parseInt($(cells[9]).text().trim()) || null;
      }
    });
  }

  // Build property.json
  const property = {
    area_under_air: grossArea ? `${grossArea.toLocaleString()} sq ft` : null,
    livable_floor_area: livingArea ? `${livingArea.toLocaleString()} sq ft` : null,
    number_of_units: Number.isFinite(totalLivingUnits)
      ? totalLivingUnits
      : null,
    number_of_units_type: null,
    parcel_identifier: parcelId || "",
    property_effective_built_year: effYearBuilt,
    property_legal_description_text:
      parcelDescription ||
      (subdivision ? subdivision.replace(/^[^\-]*-\s*/, "") : null),
    property_structure_built_year: yearBuilt,
    property_type: getPropertyType(propertyUse),
    subdivision: subdivision || null,
    total_area: landAreaSqft ? `${landAreaSqft.toLocaleString()} Sq.Ft.` : null,
    zoning: zoning || null,
    source_http_request: {
      method: "GET",
      url: "https://www.sc-pa.com/propertysearch"
    },
    request_identifier: parcelId || null,
    historic_designation: false
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Build address.json
  const address = {
    block: null,
    city_name:
      city_name ||
      (unAddr && unAddr.full_address
        ? (unAddr.full_address.split(",")[1] || "").trim().toUpperCase()
        : null),
    country_code: null,
    county_name: "Sarasota",
    latitude: null,
    longitude: null,
    lot: null,
    municipality_name: municipality || null,
    plus_four_postal_code: null,
    postal_code: postal_code || null,
    range: range || null,
    route_number: null,
    section: section || null,
    state_code: state_code || null,
    street_name: street_name || null,
    street_number: street_number || null,
    street_post_directional_text: street_post_directional || null,
    street_pre_directional_text: street_pre_directional || null,
    street_suffix_type: street_suffix_type || null,
    township: township || null,
    unit_identifier: unit_identifier || null,
  };
  writeJSON(path.join(dataDir, "address.json"), address);

  // Build lot.json
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: Number.isFinite(landAreaSqft) && landAreaSqft > 0 ? landAreaSqft : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // Build tax files for each year present in the Values table (even if $0)
  const headersMatch = (table) => {
    const headText = $(table).find("thead").text();
    return (
      /Year/i.test(headText) &&
      /Land/i.test(headText) &&
      /Building/i.test(headText)
    );
  };

  $("table.grid").each((i, table) => {
    if (!headersMatch(table)) return;
    $(table)
      .find("tbody tr")
      .each((ri, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 9) return;
        const yearText = $(tds[0])
          .text()
          .replace(/[^0-9]/g, "");
        const year = Number(yearText);
        if (!year) return;
        const land = parseCurrencyToNumber($(tds[1]).text()) ?? null;
        const building = parseCurrencyToNumber($(tds[2]).text()) ?? null;
        const just = parseCurrencyToNumber($(tds[4]).text()) ?? null;
        const assessed = parseCurrencyToNumber($(tds[5]).text()) ?? null;
        const taxable = parseCurrencyToNumber($(tds[7]).text()) ?? null;

        // Skip creating tax file if any required field is null or zero
        // Required fields: assessed, market (just), and taxable amounts
        if (!assessed || assessed <= 0 || 
            !just || just <= 0 || 
            !taxable || taxable <= 0) {
          return; // Skip this tax year
        }
        
        const tax = {
          first_year_building_on_tax_roll: null,
          first_year_on_tax_roll: null,
          monthly_tax_amount: null,
          period_end_date: null,
          period_start_date: null,
          property_assessed_value_amount: assessed,
          property_building_amount: building,
          property_land_amount: land,
          property_market_value_amount: just,
          property_taxable_value_amount: taxable,
          tax_year: year,
          yearly_tax_amount: null,
        };
        const fname = path.join(dataDir, `tax_${year}.json`);
        writeJSON(fname, tax);
      });
  });

  // Build flood_storm_information.json
  const floodRows = [];
  $("#FloodDatas tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      floodRows.push({
        panel: $(tds[0]).text().trim() || null,
        floodway: $(tds[1]).text().trim() || null,
        sfha: $(tds[2]).text().trim() || null,
        zone: $(tds[3]).text().trim() || null,
        community: $(tds[4]).text().trim() || null,
        bfe: $(tds[5]).text().trim() || null,
        cfha: $(tds[6]).text().trim() || null,
      });
    }
  });
  if (floodRows.length > 0) {
    const zones = Array.from(
      new Set(floodRows.map((r) => r.zone).filter(Boolean)),
    );
    const anyInSfha = floodRows.some(
      (r) => (r.sfha || "").toUpperCase() === "IN",
    );
    const flood = {
      community_id: floodRows[0].community || null,
      panel_number: floodRows[0].panel || null,
      map_version: null,
      effective_date: null,
      evacuation_zone: null,
      flood_zone: zones.length ? zones.join(", ") : null,
      flood_insurance_required: anyInSfha,
      fema_search_url: null,
    };
    writeJSON(path.join(dataDir, "flood_storm_information.json"), flood);
  }

  // Qualification Code to sale_type and deed_type mapping
  const qualificationCodeMapping = {
    "0": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "01": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "02": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "03": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "04": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "05": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "06": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "1": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "11": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "12": { sale_type: "ReoPostForeclosureSale", deed_type: "Special Warranty Deed" },
    "13": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "14": { sale_type: "TypicallyMotivated", deed_type: "Life Estate Deed" },
    "15": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "16": { sale_type: "TypicallyMotivated", deed_type: "Tenancy in Common Deed" },
    "17": { sale_type: "TypicallyMotivated", deed_type: "Gift Deed" },
    "18": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "19": { sale_type: "ProbateSale", deed_type: "Personal Representative Deed" },
    "20": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "21": { sale_type: "TypicallyMotivated", deed_type: "Contract for Deed" },
    "30": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "31": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "32": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "33": { sale_type: "TypicallyMotivated", deed_type: "Quitclaim Deed" },
    "34": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "35": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "36": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "37": { sale_type: "RelocationSale", deed_type: "Special Warranty Deed" },
    "38": { sale_type: "CourtOrderedNonForeclosureSale", deed_type: "Court Order Deed" },
    "39": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "40": { sale_type: "ShortSale", deed_type: "Warranty Deed" },
    "41": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "43": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "98": { sale_type: "TypicallyMotivated", deed_type: "Correction Deed" },
    "99": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "HX": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "NA": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "X2": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" },
    "X3": { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" }
  };

  // Parse sales history from HTML
  const salesHistory = [];
  const deeds = [];
  
  // Look for the sales table after "Sales & Transfers" heading
  $("span.h2").each((i, span) => {
    const text = $(span).text().trim();
    if (/Sales\s*&\s*Transfers/i.test(text)) {
      // Find the table following this heading
      const table = $(span).nextAll("table.grid").first();
      if (table.length > 0) {
        const headerText = table.find("thead").text();
        // Check if this is the sales table by looking for expected column headers
        if (/Transfer Date/i.test(headerText) && /Recorded Consideration/i.test(headerText)) {
          table.find("tbody tr").each((rowIndex, tr) => {
            const tds = $(tr).find("td");
            if (tds.length >= 6) {
              const transferDateText = $(tds[0]).text().trim();
              const considerationText = $(tds[1]).text().trim();
              const qualificationCode = $(tds[3]).text().trim(); // Qualification Code column
              
              // Parse transfer date (MM/DD/YYYY format to YYYY-MM-DD)
              let transferDate = null;
              if (transferDateText) {
                const dateParts = transferDateText.split('/');
                if (dateParts.length === 3) {
                  const month = dateParts[0].padStart(2, '0');
                  const day = dateParts[1].padStart(2, '0');
                  const year = dateParts[2];
                  transferDate = `${year}-${month}-${day}`;
                }
              }
              
              // Parse consideration amount (remove $ and commas)
              let purchasePrice = null;
              if (considerationText) {
                const cleanedAmount = considerationText.replace(/[$,]/g, '');
                const parsedAmount = parseFloat(cleanedAmount);
                if (!isNaN(parsedAmount)) {
                  purchasePrice = parsedAmount;
                }
              }
              
              // Get sale_type and deed_type from qualification code
              const mapping = qualificationCodeMapping[qualificationCode] || 
                            { sale_type: "TypicallyMotivated", deed_type: "Warranty Deed" };
              
              // Only add if we have both required fields
              if (transferDate && purchasePrice !== null && purchasePrice > 0) {
                salesHistory.push({
                  ownership_transfer_date: transferDate,
                  purchase_price_amount: purchasePrice,
                  sale_type: mapping.sale_type,
                  request_identifier: parcelId || "",
                  source_http_request: {
                    url: `https://www.sc-pa.com/propertysearch/parcel/details/${parcelId || ""}`,
                    method: "GET",
                    multiValueQueryString: {}
                  }
                });
                
                // Create corresponding deed object
                deeds.push({
                  deed_type: mapping.deed_type,
                  source_http_request: {
                    url: `https://www.sc-pa.com/propertysearch/parcel/details/${parcelId || ""}`,
                    method: "GET",
                    multiValueQueryString: {}
                  }
                });
              }
            }
          });
        }
      }
    }
  });
  
  // Write sales history and deed files
  salesHistory.forEach((sale, index) => {
    const saleFileName = path.join(dataDir, `sales_history_${index + 1}.json`);
    writeJSON(saleFileName, sale);
  });
  
  deeds.forEach((deed, index) => {
    const deedFileName = path.join(dataDir, `deed_${index + 1}.json`);
    writeJSON(deedFileName, deed);
  });

  // Owners (person/company) from owners/owner_data.json
  const ownerData = readJSON(ownerDataPath) || {};
  const ownersKey = parcelId ? `property_${parcelId}` : null;
  let currentOwners = [];
  if (
    ownersKey &&
    ownerData[ownersKey] &&
    ownerData[ownersKey].owners_by_date &&
    Array.isArray(ownerData[ownersKey].owners_by_date.current)
  ) {
    currentOwners = ownerData[ownersKey].owners_by_date.current;
  }
  let companyIndex = 1;
  let personIndex = 1;
  currentOwners.forEach((o) => {
    if (o.type === "company") {
      const company = { name: o.name || null };
      writeJSON(path.join(dataDir, `company_${companyIndex}.json`), company);
      companyIndex += 1;
    } else if (o.type === "person") {
      const person = {
        birth_date: null,
        first_name: o.first_name || null,
        last_name: o.last_name || null,
        middle_name: null,
        prefix_name: null,
        suffix_name: null,
        us_citizenship_status: null,
        veteran_status: null,
      };
      writeJSON(path.join(dataDir, `person_${personIndex}.json`), person);
      personIndex += 1;
    }
  });

  // Utilities from owners/utilities_data.json
  const utilData = readJSON(utilDataPath) || {};
  const util = ownersKey && utilData[ownersKey] ? utilData[ownersKey] : null;
  if (util) {
    const utility = {
      cooling_system_type: util.cooling_system_type ?? null,
      heating_system_type: util.heating_system_type ?? null,
      public_utility_type: util.public_utility_type ?? null,
      sewer_type: util.sewer_type ?? null,
      water_source_type: util.water_source_type ?? null,
      plumbing_system_type: util.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        util.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: util.electrical_panel_capacity ?? null,
      electrical_wiring_type: util.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: util.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        util.electrical_wiring_type_other_description ?? null,
      solar_panel_present: util.solar_panel_present === true,
      solar_panel_type: util.solar_panel_type ?? null,
      solar_panel_type_other_description:
        util.solar_panel_type_other_description ?? null,
      smart_home_features: util.smart_home_features ?? null,
      smart_home_features_other_description:
        util.smart_home_features_other_description ?? null,
      hvac_unit_condition: util.hvac_unit_condition ?? null,
      solar_inverter_visible: util.solar_inverter_visible === true,
      hvac_unit_issues: util.hvac_unit_issues ?? null,
    };
    writeJSON(path.join(dataDir, "utility.json"), utility);
  }

  // Layouts from owners/layout_data.json (if any)
  const layoutData = readJSON(layoutDataPath) || {};
  const layouts =
    ownersKey &&
    layoutData[ownersKey] &&
    Array.isArray(layoutData[ownersKey].layouts)
      ? layoutData[ownersKey].layouts
      : [];
  if (layouts && layouts.length) {
    layouts.forEach((layout, idx) => {
      writeJSON(path.join(dataDir, `layout_${idx + 1}.json`), layout);
    });
  }

  // Structure: from input.html; for vacant land, emit required keys as nulls
  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: null,
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
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
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
    number_of_stories: numberOfStories,
    finished_base_area: livingArea,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Parse exemptions
  const exemptionsDiv = $("#exemptions");
  const exemptions = [];
  if (exemptionsDiv.length > 0) {
    // Check if it's a homestead property
    const homesteadText = exemptionsDiv.find("span:contains('Homestead Property')").text();
    const isHomestead = homesteadText.includes("Yes");
    
    // Parse exemption table
    exemptionsDiv.find("table tbody tr").each((i, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const grantYear = parseInt($(cells[0]).text().trim()) || null;
        const value = parseCurrencyToNumber($(cells[1]).text());
        const description = cells.length >= 3 ? $(cells[2]).text().trim() : "";
        
        if (grantYear && value) {
          exemptions.push({
            exemption_type: value === 25000 ? "Homestead" : "Additional Homestead",
            exemption_amount: value,
            grant_year: grantYear,
            is_active: !description.includes("not renew")
          });
        }
      }
    });
  }
  
  // Write exemptions
  exemptions.forEach((exemption, idx) => {
    writeJSON(path.join(dataDir, `exemption_${idx + 1}.json`), exemption);
  });

  // Create relationships
  // Property relationships
  writeJSON(path.join(dataDir, "relationship_property_address.json"), {
    from: "property",
    to: "address"
  });
  
  writeJSON(path.join(dataDir, "relationship_property_lot.json"), {
    from: "property",
    to: "lot"
  });
  
  writeJSON(path.join(dataDir, "relationship_property_structure.json"), {
    from: "property",
    to: "structure"
  });
  
  if (utilData && utilData[ownersKey]) {
    writeJSON(path.join(dataDir, "relationship_property_utility.json"), {
      from: "property",
      to: "utility"
    });
  }
  
  if (floodRows.length > 0) {
    writeJSON(path.join(dataDir, "relationship_property_flood_storm_information.json"), {
      from: "property",
      to: "flood_storm_information"
    });
  }
  
  // Tax relationships
  fs.readdirSync(dataDir).forEach(file => {
    const match = file.match(/^tax_(\d{4})\.json$/);
    if (match) {
      const year = match[1];
      writeJSON(path.join(dataDir, `relationship_property_tax_${year}.json`), {
        from: "property",
        to: `tax_${year}`
      });
    }
  });
  
  // Exemption relationships
  exemptions.forEach((exemption, index) => {
    writeJSON(path.join(dataDir, `relationship_property_exemption_${index + 1}.json`), {
      from: "property",
      to: `exemption_${index + 1}`
    });
  });

  // Sales history relationships
  salesHistory.forEach((sale, index) => {
    writeJSON(path.join(dataDir, `relationship_property_sales_history_${index + 1}.json`), {
      from: "property",
      to: `sales_history_${index + 1}`
    });
    
    // Sales history to deed relationship
    writeJSON(path.join(dataDir, `relationship_sales_history_${index + 1}_deed_${index + 1}.json`), {
      from: {"/": `./sales_history_${index + 1}.json`},
      to: {"/": `./deed_${index + 1}.json`}
    });
  });
  
  // Owner relationships
  currentOwners.forEach((owner, index) => {
    if (owner.type === "company") {
      const companyFiles = fs.readdirSync(dataDir).filter(f => f.startsWith("company_"));
      const companyIndex = companyFiles.indexOf(`company_${index + 1}.json`) + 1;
      if (companyIndex > 0) {
        writeJSON(path.join(dataDir, `relationship_company_${companyIndex}_property.json`), {
          from: `company_${companyIndex}`,
          to: "property"
        });
      }
    } else if (owner.type === "person") {
      const personFiles = fs.readdirSync(dataDir).filter(f => f.startsWith("person_"));
      const personIndex = personFiles.indexOf(`person_${index + 1}.json`) + 1;
      if (personIndex > 0) {
        writeJSON(path.join(dataDir, `relationship_person_${personIndex}_property.json`), {
          from: `person_${personIndex}`,
          to: "property"
        });
      }
    }
  });
  
  // Layout relationships
  if (layouts && layouts.length) {
    layouts.forEach((layout, idx) => {
      writeJSON(path.join(dataDir, `relationship_property_layout_${idx + 1}.json`), {
        from: "property",
        to: `layout_${idx + 1}`
      });
    });
  }
  
  // Fact sheet relationships
  writeJSON(path.join(dataDir, "relationship_property_to_fact_sheet.json"), {
    from: "property",
    to: "fact_sheet"
  });
  
  writeJSON(path.join(dataDir, "relationship_address_to_fact_sheet.json"), {
    from: "address",
    to: "fact_sheet"
  });
  
  writeJSON(path.join(dataDir, "relationship_lot_to_fact_sheet.json"), {
    from: "lot",
    to: "fact_sheet"
  });
  
  writeJSON(path.join(dataDir, "relationship_structure_to_fact_sheet.json"), {
    from: "structure",
    to: "fact_sheet"
  });
  
  if (utilData && utilData[ownersKey]) {
    writeJSON(path.join(dataDir, "relationship_utility_to_fact_sheet.json"), {
      from: "utility",
      to: "fact_sheet"
    });
  }
  
  if (floodRows.length > 0) {
    writeJSON(path.join(dataDir, "relationship_flood_storm_information_to_fact_sheet.json"), {
      from: "flood_storm_information",
      to: "fact_sheet"
    });
  }
  
  // Tax to fact sheet relationships
  fs.readdirSync(dataDir).forEach(file => {
    const match = file.match(/^tax_(\d{4})\.json$/);
    if (match) {
      const year = match[1];
      writeJSON(path.join(dataDir, `relationship_tax_${year}_to_fact_sheet.json`), {
        from: `tax_${year}`,
        to: "fact_sheet"
      });
    }
  });
  
  // Person to fact sheet relationships
  let personFactSheetIndex = 1;
  while (fs.existsSync(path.join(dataDir, `person_${personFactSheetIndex}.json`))) {
    writeJSON(path.join(dataDir, `relationship_person_${personFactSheetIndex}_to_fact_sheet.json`), {
      from: `person_${personFactSheetIndex}`,
      to: "fact_sheet"
    });
    personFactSheetIndex++;
  }

  // Sales/Deed/Files/Relationships: not created unless discoverable data present
}

main();
