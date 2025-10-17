const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJson(p) {
  const content = fs.readFileSync(p, "utf8");
  // Check if it's HTML (error page) instead of JSON
  if (content.trim().startsWith('<')) {
    return null; // Return null for HTML error pages
  }
  return JSON.parse(content);
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function formatNameForValidation(name) {
  if (!name || typeof name !== "string") return null;
  
  // Clean the name: remove special characters except spaces, hyphens, apostrophes, periods, commas
  let cleaned = name.trim().replace(/[^A-Za-z\s\-',.]/g, "");
  
  // If empty after cleaning, return null
  if (!cleaned) return null;
  
  // Apply title case formatting
  cleaned = cleaned
    .toLowerCase()
    .replace(/(^|[\s\-'])[a-z]/g, (s) => s.toUpperCase());
  
  // Check if it matches the required pattern: ^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$
  const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (pattern.test(cleaned)) {
    return cleaned;
  }
  
  // If it doesn't match, try to fix common issues
  // Remove multiple spaces and ensure proper capitalization
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // If still doesn't match, return null to avoid validation errors
  if (!pattern.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

function parseISODate(mdy) {
  if (!mdy) return null;
  // supports MM/DD/YYYY or M/D/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(mdy);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function mapDorToPropertyType(dorCode, dorDescription) {
  if (!dorCode || typeof dorCode !== "string" || dorCode.length < 2) {
    // Use DORDescription as-is to trigger validation error
    return {
      property_type: dorDescription || "MISSING_DOR_CODE_AND_DESCRIPTION",
      property_usage_type: null,
      structure_form: null,
      build_status: null,
      ownership_estate_type: null
    };
  }
  
  // Handle 0000 REFERENCE FOLIO case - map to ReferenceParcel usage type
  if (dorCode === "0000" && dorDescription === "REFERENCE FOLIO") {
    return { 
      property_type: "LandParcel",
      property_usage_type: "ReferenceParcel",
      structure_form: null,
      build_status: null,
      ownership_estate_type: null
    };
  }
  
  const prefix = dorCode.slice(0, 2);
  const desc = (dorDescription || "").toUpperCase();
  
  switch (prefix) {
    case "00":
      // VACANT LAND (various types)
      return {
        property_type: "LandParcel",
        property_usage_type: desc.includes("COMMERCIAL") ? "Commercial" : "Residential",
        structure_form: null,
        build_status: "VacantLand",
        ownership_estate_type: null
      };
      
    case "01":
      // SINGLE FAMILY
      return {
        property_type: "LandParcel",
        property_usage_type: "Residential",
        structure_form: "SingleFamilyDetached",
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "02":
      // MOBILE HOME
      return {
        property_type: "ManufacturedHome",
        property_usage_type: "Residential",
        structure_form: "MobileHome",
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "03":
      // MULTI-FAMILY 10+ UNITS
      return {
        property_type: "Building",
        property_usage_type: "Residential",
        structure_form: "MultiFamily5Plus",
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "04":
      // CONDOMINIUM
      return {
        property_type: "Unit",
        property_usage_type: "Residential",
        structure_form: "ApartmentUnit",
        build_status: "Improved",
        ownership_estate_type: "Condominium"
      };
      
    case "05":
      // COOPERATIVE
      return {
        property_type: "Unit",
        property_usage_type: "Residential",
        structure_form: "ApartmentUnit",
        build_status: "Improved",
        ownership_estate_type: "Cooperative"
      };
      
    case "08":
      // MULTI-FAMILY < 10 UNITS
      if (dorCode === "0800" || dorCode === "0801") {
        return {
          property_type: "Building",
          property_usage_type: "Residential",
          structure_form: "Duplex",
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      if (dorCode === "0802") {
        return {
          property_type: "Building",
          property_usage_type: "Residential",
          structure_form: "Triplex",
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      // 0803 and other multi-family < 10 (default to MultiFamily5Plus)
      return {
        property_type: "Building",
        property_usage_type: "Residential",
        structure_form: "MultiFamily5Plus",
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "09":
      // RESIDENTIAL COMMON ELEMENTS/AREAS
      // Handles 0951 COMMON AREAS and other 09xx codes
      return {
        property_type: "Unit",
        property_usage_type: "ResidentialCommonElementsAreas",
        structure_form: null,
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "10":
      // VACANT LAND - COMMERCIAL
      return {
        property_type: "LandParcel",
        property_usage_type: "Commercial",
        structure_form: null,
        build_status: "VacantLand",
        ownership_estate_type: null
      };
      
    case "11":
    case "12":
    case "13":
    case "14":
    case "15":
      // COMMERCIAL - Stores, Offices, etc.
      // Special handling for 1209 Mixed Use
      if (dorCode === "1209") {
        return {
          property_type: "Building",
          property_usage_type: "MixedUse",
          structure_form: null,
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      return {
        property_type: desc.includes("VACANT") ? "LandParcel" : "Building",
        property_usage_type: "Commercial",
        structure_form: null,
        build_status: desc.includes("VACANT") ? "VacantLand" : "Improved",
        ownership_estate_type: null
      };
      
    case "16":
    case "17":
    case "18":
    case "19":
      // COMMERCIAL - Misc (Hotels, Parking, etc.)
      return {
        property_type: desc.includes("VACANT") ? "LandParcel" : "Building",
        property_usage_type: "Commercial",
        structure_form: null,
        build_status: desc.includes("VACANT") ? "VacantLand" : "Improved",
        ownership_estate_type: null
      };
      
    case "20":
    case "21":
    case "22":
    case "23":
    case "24":
    case "25":
    case "48":
      // INDUSTRIAL (includes warehouses, manufacturing, terminals, storage)
      return {
        property_type: desc.includes("VACANT") ? "LandParcel" : "Building",
        property_usage_type: "Industrial",
        structure_form: null,
        build_status: desc.includes("VACANT") ? "VacantLand" : "Improved",
        ownership_estate_type: null
      };
      
    case "26":
    case "27":
    case "28":
    case "29":
      // AGRICULTURAL (Note: 28 can be parking lot which is commercial)
      if (desc.includes("PARKING LOT") || desc.includes("MOBILE HOME PARK")) {
        return {
          property_type: "LandParcel",
          property_usage_type: "Commercial",
          structure_form: null,
          build_status: desc.includes("VACANT") ? "VacantLand" : "Improved",
          ownership_estate_type: null
        };
      }
      return {
        property_type: "LandParcel",
        property_usage_type: "Agricultural",
        structure_form: null,
        build_status: desc.includes("IMPROVED") ? "Improved" : "VacantLand",
        ownership_estate_type: null
      };
      
    case "30":
    case "31":
    case "32":
    case "33":
    case "40":
    case "41":
    case "42":
    case "43":
    case "44":
    case "45":
    case "46":
    case "47":
    case "49":
      // INSTITUTIONAL & GOVERNMENT (Schools, Churches, Hospitals, Utilities, etc.)
      if (desc.includes("CHURCH")) {
        return {
          property_type: "Building",
          property_usage_type: "Church",
          structure_form: null,
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      if (desc.includes("SCHOOL")) {
        return {
          property_type: "Building",
          property_usage_type: desc.includes("PRIVATE") ? "PrivateSchool" : "PublicSchool",
          structure_form: null,
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      if (desc.includes("HOSPITAL")) {
        return {
          property_type: "Building",
          property_usage_type: desc.includes("PRIVATE") ? "PrivateHospital" : "PublicHospital",
          structure_form: null,
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      if (desc.includes("UTILITY")) {
        return {
          property_type: "Building",
          property_usage_type: "Utility",
          structure_form: null,
          build_status: "Improved",
          ownership_estate_type: null
        };
      }
      // Default: GovernmentProperty for all 30-49 codes
      return {
        property_type: "Building",
        property_usage_type: "GovernmentProperty",
        structure_form: null,
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    case "50":
    case "51":
    case "52":
    case "53":
    case "54":
    case "55":
    case "56":
    case "57":
    case "58":
    case "59":
    case "60":
    case "61":
    case "62":
    case "63":
    case "64":
    case "65":
    case "66":
    case "67":
    case "68":
    case "69":
    case "70":
    case "71":
    case "72":
    case "73":
    case "74":
    case "75":
    case "76":
    case "77":
    case "78":
    case "79":
    case "80":
    case "81":
    case "82":
    case "83":
    case "84":
    case "85":
    case "86":
    case "87":
    case "88":
    case "89":
    case "90":
    case "91":
    case "92":
    case "93":
    case "94":
    case "95":
    case "96":
    case "97":
    case "98":
    case "99":
      // INSTITUTIONAL, GOVERNMENT, EXEMPT, MISCELLANEOUS (50-99)
      // Check for vacant land
      if (desc.includes("VACANT")) {
        return {
          property_type: "LandParcel",
          property_usage_type: "GovernmentProperty",
          structure_form: null,
          build_status: "VacantLand",
          ownership_estate_type: null
        };
      }
      // Otherwise improved government property
      return {
        property_type: "Building",
        property_usage_type: "GovernmentProperty",
        structure_form: null,
        build_status: "Improved",
        ownership_estate_type: null
      };
      
    default:
      // Unmapped - use description as property_type to trigger validation error
      return {
        property_type: dorDescription || `Unknown DOR Code ${dorCode}`,
        property_usage_type: null,
        structure_form: null,
        build_status: null,
        ownership_estate_type: null
      };
  }
}


function validateAreaUnderAir(area) {
  if (!area) return null;
  
  // Convert to string and clean
  const areaStr = String(area).trim();
  if (!areaStr) return null;
  
  // Remove commas and extra spaces
  const cleaned = areaStr.replace(/,/g, '').replace(/\s+/g, ' ').trim();
  
  // Check if it matches numeric pattern (digits with optional decimal)
  const numericPattern = /^\d+(\.\d+)?$/;
  if (numericPattern.test(cleaned)) {
    return cleaned;
  }
  
  // If it doesn't match the pattern, return null to avoid validation errors
  return null;
}

function extractLotSizeFromLegal(desc) {
  if (!desc) return { width: null, length: null };
  // Expect pattern like "LOT SIZE     50.000 X   150"
  const m = /LOT SIZE\s+([\d.]+)\s*X\s*([\d.]+)/i.exec(desc);
  if (!m) return { width: null, length: null };
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  if (isNaN(a) || isNaN(b)) return { width: null, length: null };
  // Convention: width along street (smaller), depth is larger
  const width = Math.round(Math.min(a, b));
  const length = Math.round(Math.max(a, b));
  return { width, length };
}

function lotTypeFromSqft(sf) {
  if (sf == null) return null;
  const acres = Number(sf) / 43560;
  if (!isFinite(acres)) return null;
  return acres <= 0.25
    ? "LessThanOrEqualToOneQuarterAcre"
    : "GreaterThanOneQuarterAcre";
}

// For fields requiring at least two digits in the string (e.g., property.total_area)
function areaStringOrNull(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  return /\d{2,}/.test(s) ? s : null;
}

function main() {
  const inputPath = path.join("input.json");
  const addrPath = path.join("unnormalized_address.json");
  const parcelPath = path.join("parcel.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const input = readJson(inputPath);
  const unAddr = readJson(addrPath);
  
  // Try to read parcel.json first, fallback to property_seed.json
  const parcel = fs.existsSync(parcelPath) ? readJson(parcelPath) : null;
  const seed = readJson(seedPath);
  
  // Get parcel_identifier from parcel.json or fall back to seed.parcel_id
  const parcelIdentifier = (parcel && parcel.parcel_identifier) || seed.parcel_id || null;
  
  // Get source_http_request from parcel.json or property_seed.json
  const sourceHttpRequest = (parcel && parcel.source_http_request) || (seed && seed.source_http_request) || null;
  
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  ensureDir("data");

  // Handle failed API request (HTML error page)
  if (!input) {
    console.error("No valid property data found - likely a failed API request");
    process.exit(1); // Exit with error code to prevent processing
  }

  // PROPERTY
  const pInfo = input.PropertyInfo || {};
  const legal = input.LegalDescription || {};
  const building = input.Building || {};

  const dorCode = pInfo.DORCode || null;
  const dorDescription = pInfo.DORDescription || null;
  
  const mappedType = mapDorToPropertyType(dorCode, dorDescription);

  // Determine built years from BuildingInfos
  let builtYear = null;
  let effYear = null;
  if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
    const mainSegs = input.Building.BuildingInfos.filter(
      (b) => b && b.BuildingNo === 1 && b.SegNo === 1,
    );
    if (mainSegs.length) {
      const actuals = mainSegs.map((x) => x.Actual).filter((x) => x);
      const effs = mainSegs.map((x) => x.Effective).filter((x) => x);
      if (actuals.length) builtYear = Math.min(...actuals);
      if (effs.length) effYear = Math.min(...effs);
    }
  }
  if (!builtYear) {
    const yearBuiltNum =
      typeof pInfo.YearBuilt === "string"
        ? parseInt(pInfo.YearBuilt, 10)
        : pInfo.YearBuilt;
    if (Number.isFinite(yearBuiltNum)) builtYear = yearBuiltNum;
  }


  const property = {
    source_http_request: sourceHttpRequest,
    request_identifier: parcelIdentifier,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: legal.Description || null,
    property_structure_built_year: builtYear || null,
    property_effective_built_year: effYear || null,
    property_type: mappedType.property_type || null,
    property_usage_type: mappedType.property_usage_type || null,
    structure_form: mappedType.structure_form || null,
    build_status: mappedType.build_status || null,
    ownership_estate_type: mappedType.ownership_estate_type || null,
    number_of_units_type: null,
    number_of_units: pInfo.UnitCount != null ? Number(pInfo.UnitCount) : null,
    livable_floor_area: areaStringOrNull(pInfo.BuildingHeatedArea),
    area_under_air: validateAreaUnderAir(pInfo.BuildingHeatedArea),
    total_area: areaStringOrNull(pInfo.BuildingGrossArea),
    subdivision: pInfo.SubdivisionDescription || null,
    zoning: pInfo.PrimaryZoneDescription || null,
  };

  writeJson(path.join("data", "property.json"), property);

  // ADDRESS
  // Use unnormalized format (oneOf Option 1)
  // Required fields: source_http_request, request_identifier, county_name, unnormalized_address, longitude, latitude
  const address = {
    source_http_request: sourceHttpRequest,
    request_identifier: parcelIdentifier,
    county_name: unAddr.county_jurisdiction || "Miami Dade",
    unnormalized_address: unAddr.full_address || null,
    longitude: null,
    latitude: null
  };

  writeJson(path.join("data", "address.json"), address);

  // LOT
  const lotSizeRaw = pInfo.LotSize;
  let lotSize = null;
  if (lotSizeRaw != null && String(lotSizeRaw).trim() !== "") {
    const n = Number(lotSizeRaw);
    // Preserve fractional square footage when provided
    lotSize = isFinite(n) && n > 0 ? n : null;
  }

  const { width: lotWidth, length: lotLength } = extractLotSizeFromLegal(
    legal.Description || "",
  );

  // Fencing detection
  let fencingType = null;
  let fenceLengthStr = null;
  let fenceHeight = null;
  if (
    input.ExtraFeature &&
    Array.isArray(input.ExtraFeature.ExtraFeatureInfos)
  ) {
    for (const ef of input.ExtraFeature.ExtraFeatureInfos) {
      if (
        ef &&
        typeof ef.Description === "string" &&
        /fence/i.test(ef.Description)
      ) {
        const desc = ef.Description.toLowerCase();
        if (/chain.?link/i.test(desc)) {
          fencingType = "ChainLink";
        } else if (/wood/i.test(desc)) {
          fencingType = "Wood";
        } else if (/vinyl/i.test(desc)) {
          fencingType = "Vinyl";
        } else if (/aluminum/i.test(desc)) {
          fencingType = "Aluminum";
        } else if (/wrought.?iron/i.test(desc)) {
          fencingType = "WroughtIron";
        } else if (/bamboo/i.test(desc)) {
          fencingType = "Bamboo";
        } else if (/composite/i.test(desc)) {
          fencingType = "Composite";
        } else if (/privacy/i.test(desc)) {
          fencingType = "Privacy";
        } else if (/picket/i.test(desc)) {
          fencingType = "Picket";
        } else if (/split.?rail/i.test(desc)) {
          fencingType = "SplitRail";
        } else if (/stockade/i.test(desc)) {
          fencingType = "Stockade";
        } else if (/board/i.test(desc)) {
          fencingType = "Board";
        } else if (/post.?and.?rail/i.test(desc)) {
          fencingType = "PostAndRail";
        } else if (/lattice/i.test(desc)) {
          fencingType = "Lattice";
        } else {
          fencingType = "Wood"; // Default to Wood
        }
        
        if (ef.Units != null) {
          const l = Math.round(Number(ef.Units));
          // Map to valid enum values
          if (l <= 25) fenceLengthStr = "25ft";
          else if (l <= 50) fenceLengthStr = "50ft";
          else if (l <= 75) fenceLengthStr = "75ft";
          else if (l <= 100) fenceLengthStr = "100ft";
          else if (l <= 150) fenceLengthStr = "150ft";
          else if (l <= 200) fenceLengthStr = "200ft";
          else if (l <= 300) fenceLengthStr = "300ft";
          else if (l <= 500) fenceLengthStr = "500ft";
          else if (l <= 1000) fenceLengthStr = "1000ft";
          else fenceLengthStr = "1000ft"; // Default to max
        }
        
        // Extract height from description (e.g., "4-5 ft high")
        const heightMatch = desc.match(/(\d+)-?(\d+)?\s*ft\s*high/i);
        if (heightMatch) {
          const height = parseInt(heightMatch[1]);
          // Map to valid enum values
          if (height <= 3) fenceHeight = "3ft";
          else if (height <= 4) fenceHeight = "4ft";
          else if (height <= 5) fenceHeight = "5ft";
          else if (height <= 6) fenceHeight = "6ft";
          else if (height <= 8) fenceHeight = "8ft";
          else if (height <= 10) fenceHeight = "10ft";
          else if (height <= 12) fenceHeight = "12ft";
          else fenceHeight = "6ft"; // Default
        }
        break;
      }
    }
  }

  // Extract site lighting and paving from ExtraFeatureInfos
  const extraFeature = input.ExtraFeature || {};
  const extraFeatureInfos = Array.isArray(extraFeature.ExtraFeatureInfos)
    ? extraFeature.ExtraFeatureInfos
    : [];

  const siteLighting = {
    type: null,
    fixtureCount: null,
    installationDate: null
  };
  
  const sitePaving = {
    type: null,
    areaSqft: null,
    installationDate: null
  };

  for (const ef of extraFeatureInfos) {
    const desc = ef.Description || "";
    const yearBuilt = ef.ActualYearBuilt;
    
    // Extract lighting information
    if (/LIGHT\s*STANDARD/i.test(desc)) {
      // Determine lighting type based on height
      if (/10-30\s*ft/i.test(desc)) {
        siteLighting.type = "LightStandard10to30ft";
      } else if (/under\s*10\s*ft|below\s*10\s*ft|<\s*10\s*ft/i.test(desc)) {
        siteLighting.type = "LightStandardUnder10ft";
      } else if (/over\s*30\s*ft|above\s*30\s*ft|>\s*30\s*ft/i.test(desc)) {
        siteLighting.type = "LightStandardOver30ft";
      } else {
        siteLighting.type = "LightStandard10to30ft"; // Default
      }
      
      // Extract fixture count
      const fixtureMatch = desc.match(/(\d+)\s*fixture/i);
      if (fixtureMatch) {
        siteLighting.fixtureCount = parseInt(fixtureMatch[1]);
      }
      
      // Extract installation date
      if (yearBuilt && !siteLighting.installationDate) {
        siteLighting.installationDate = `${yearBuilt}-01-01`;
      }
    }
    
    // Extract paving information
    if (/PAVING/i.test(desc)) {
      // Determine paving type
      if (/asphalt/i.test(desc)) {
        sitePaving.type = "Asphalt";
      } else if (/concrete/i.test(desc)) {
        sitePaving.type = "Concrete";
      } else if (/gravel/i.test(desc)) {
        sitePaving.type = "Gravel";
      } else if (/paver/i.test(desc)) {
        sitePaving.type = "Pavers";
      } else if (/brick/i.test(desc)) {
        sitePaving.type = "Brick";
      }
      
      // Extract area
      if (ef.Units != null && ef.Units > 0) {
        sitePaving.areaSqft = ef.Units;
      }
      
      // Extract installation date
      if (yearBuilt && !sitePaving.installationDate) {
        sitePaving.installationDate = `${yearBuilt}-01-01`;
      }
    }
  }

  const lot = {
    source_http_request: sourceHttpRequest,
    request_identifier: parcelIdentifier,
    lot_type: lotTypeFromSqft(lotSize),
    lot_length_feet: lotLength != null ? lotLength : null,
    lot_width_feet: lotWidth != null ? lotWidth : null,
    lot_area_sqft: lotSize != null ? Math.round(lotSize) : null,
    landscaping_features: null,
    view: null,
    fencing_type: fencingType,
    fence_height: fenceHeight,
    fence_length: fenceLengthStr,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotSize != null ? lotSize / 43560 : null,
  };
  
  // Only include site lighting fields if they exist
  if (siteLighting.type) {
    lot.site_lighting_type = siteLighting.type;
  }
  if (siteLighting.fixtureCount) {
    lot.site_lighting_fixture_count = siteLighting.fixtureCount;
  }
  if (siteLighting.installationDate) {
    lot.site_lighting_installation_date = siteLighting.installationDate;
  }
  
  // Only include paving fields if they exist
  if (sitePaving.type) {
    lot.paving_type = sitePaving.type;
  }
  if (sitePaving.areaSqft) {
    lot.paving_area_sqft = sitePaving.areaSqft;
  }
  if (sitePaving.installationDate) {
    lot.paving_installation_date = sitePaving.installationDate;
  }
  
  writeJson(path.join("data", "lot.json"), lot);

  // TAX
  if (input.Assessment && Array.isArray(input.Assessment.AssessmentInfos)) {
    const assessedByYear = new Map();
    for (const ai of input.Assessment.AssessmentInfos) {
      assessedByYear.set(ai.Year, ai);
    }
    const taxableByYear = new Map();
    if (input.Taxable && Array.isArray(input.Taxable.TaxableInfos)) {
      for (const ti of input.Taxable.TaxableInfos) {
        taxableByYear.set(ti.Year, ti);
      }
    }

    // Calculate building values by year from BuildingInfos
    const buildingValuesByYear = new Map();
    if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
      for (const bi of input.Building.BuildingInfos) {
        if (!bi || bi.RollYear == null) continue;
        
        const year = bi.RollYear;
        if (!buildingValuesByYear.has(year)) {
          buildingValuesByYear.set(year, {
            totalDepreciatedValue: 0,
            totalReplacementCost: 0
          });
        }
        
        const yearData = buildingValuesByYear.get(year);
        
        // Sum DepreciatedValue
        if (bi.DepreciatedValue != null && bi.DepreciatedValue > 0) {
          yearData.totalDepreciatedValue += Number(bi.DepreciatedValue);
        }
        
        // Sum ReplacementCostNew
        if (bi.ReplacementCostNew != null && bi.ReplacementCostNew > 0) {
          yearData.totalReplacementCost += Number(bi.ReplacementCostNew);
        }
      }
    }

    for (const [year, ai] of assessedByYear.entries()) {
      const ti = taxableByYear.get(year) || {};
      const buildingData = buildingValuesByYear.get(year);
      
      const tax = {
        tax_year: year != null ? Number(year) : null,
        property_assessed_value_amount:
          ai.AssessedValue != null ? Number(ai.AssessedValue) : null,
        property_market_value_amount:
          ai.TotalValue != null ? Number(ai.TotalValue) : null,
        property_building_amount:
          ai.BuildingOnlyValue != null ? Number(ai.BuildingOnlyValue) : null,
        property_land_amount:
          ai.LandValue != null ? Number(ai.LandValue) : null,
        property_taxable_value_amount:
          ti.SchoolTaxableValue != null ? Number(ti.SchoolTaxableValue) : null,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: null,
        first_year_on_tax_roll: null,
        first_year_building_on_tax_roll: null,
        request_identifier: parcelIdentifier,
      };
      
      // Only include building values if they exist
      if (buildingData && buildingData.totalDepreciatedValue > 0) {
        tax.building_depreciated_value_amount = buildingData.totalDepreciatedValue;
      }
      if (buildingData && buildingData.totalReplacementCost > 0) {
        tax.building_replacement_cost_amount = buildingData.totalReplacementCost;
      }
      
      writeJson(path.join("data", `tax_${year}.json`), tax);
    }
  }

  // SALES + DEEDS + FILES (create one deed per sale; optionally create file per book/page or instrument)
  if (Array.isArray(input.SalesInfos) && input.SalesInfos.length) {
    let saleIndex = 1;
    /**
     * @typedef {Object} MiamiSaleMeta
     * @property {number} index
     * @property {string|null} date
     * @property {string|null} book
     * @property {string|null} page
     * @property {string|null} instrument
     * @property {string|null} saleType
     */
    /** @type {MiamiSaleMeta[]} */
    const salesFiles = [];

    /**
     * Extract a string value or null from an arbitrary field.
     * @param {unknown} v
     * @returns {string|null}
     */
    function asStringOrNull(v) {
      if (v == null) return null;
      const t = String(v).trim();
      return t === "" ? null : t;
    }

    /**
     * Map Miami-Dade SaleInstrument codes to Elephant Lexicon deed types.
     * @param {string|null} s
     * @returns {"Warranty Deed"|"Special Warranty Deed"|"Quitclaim Deed"|"Grant Deed"|"Bargain and Sale Deed"|"Lady Bird Deed"|"Transfer on Death Deed"|"Sheriff's Deed"|"Tax Deed"|"Trustee's Deed"|"Personal Representative Deed"|"Correction Deed"|"Deed in Lieu of Foreclosure"|"Life Estate Deed"|"Joint Tenancy Deed"|"Tenancy in Common Deed"|"Community Property Deed"|"Gift Deed"|"Interspousal Transfer Deed"|"Wild Deed"|"Special Master's Deed"|"Court Order Deed"|"Contract for Deed"|"Quiet Title Deed"|"Administrator's Deed"|"Guardian's Deed"|"Receiver's Deed"|"Right of Way Deed"|"Vacation of Plat Deed"|"Assignment of Contract"|"Release of Contract"}
     */
    function mapDeedType(s) {
      if (!s) return "Warranty Deed"; // Default to most common deed type
      const t = s.toUpperCase().trim();
      
      // Miami-Dade SaleInstrument code mappings
      switch (t) {
        case "QCD": return "Quitclaim Deed";
        case "DEE": return "Warranty Deed"; // General deed, assume warranty
        case "WDE": return "Warranty Deed";
        case "SWD": return "Special Warranty Deed";
        case "GRD": return "Grant Deed";
        case "BSD": return "Bargain and Sale Deed";
        case "LBD": return "Lady Bird Deed";
        case "TOD": return "Transfer on Death Deed";
        case "SHD": return "Sheriff's Deed";
        case "TXD": return "Tax Deed";
        case "TRD": return "Trustee's Deed";
        case "PRD": return "Personal Representative Deed";
        case "CRD": return "Correction Deed";
        case "DIL": return "Deed in Lieu of Foreclosure";
        case "LED": return "Life Estate Deed";
        case "JTD": return "Joint Tenancy Deed";
        case "TCD": return "Tenancy in Common Deed";
        case "CPD": return "Community Property Deed";
        case "GFT": return "Gift Deed";
        case "ITD": return "Interspousal Transfer Deed";
        case "WLD": return "Wild Deed";
        case "SMD": return "Special Master's Deed";
        case "COD": return "Court Order Deed";
        case "CFD": return "Contract for Deed";
        case "QTD": return "Quiet Title Deed";
        case "ADM": return "Administrator's Deed";
        case "GAD": return "Guardian's Deed";
        case "RCD": return "Receiver's Deed";
        case "RWD": return "Right of Way Deed";
        case "VPD": return "Vacation of Plat Deed";
        case "AOC": return "Assignment of Contract";
        case "ROC": return "Release of Contract";
        default: return "Warranty Deed"; // Default fallback
      }
    }

    /**
     * Map Miami-Dade SaleInstrument codes to Elephant Lexicon file document types.
     * @param {string|null} s
     * @returns {"ConveyanceDeedQuitClaimDeed"|"ConveyanceDeedBargainAndSaleDeed"|"ConveyanceDeedWarrantyDeed"|"ConveyanceDeed"|"AssignmentAssignmentOfDeedOfTrust"|"AssignmentAssignmentOfMortgage"|"AssignmentAssignmentOfRents"|"Assignment"|"AssignmentAssignmentOfTrade"|"AssignmentBlanketAssignment"|"AssignmentCooperativeAssignmentOfProprietaryLease"|"AffidavitOfDeath"|"AbstractOfJudgment"|"AttorneyInFactAffidavit"|"ArticlesOfIncorporation"|"BuildingPermit"|"ComplianceInspectionReport"|"ConditionalCommitment"|"CounselingCertification"|"AirportNoisePollutionAgreement"|"BreachNotice"|"BrokerPriceOpinion"|"AmendatoryClause"|"AssuranceOfCompletion"|"Bid"|"BuildersCertificationBuilderCertificationOfPlansAndSpecifications"|"BuildersCertificationBuildersCertificate"|"BuildersCertificationPropertyInspection"|"BuildersCertificationTermiteTreatment"|"PropertyImage"}
     */
    function mapFileDocType(s) {
      if (!s) return "ConveyanceDeedWarrantyDeed"; // Default to most common deed type
      const t = s.toUpperCase().trim();
      
      // Miami-Dade SaleInstrument code mappings to file document types
      switch (t) {
        case "QCD": return "ConveyanceDeedQuitClaimDeed";
        case "DEE": return "ConveyanceDeedWarrantyDeed"; // General deed, assume warranty
        case "WDE": return "ConveyanceDeedWarrantyDeed";
        case "SWD": return "ConveyanceDeedWarrantyDeed"; // Special warranty maps to warranty
        case "GRD": return "ConveyanceDeed";
        case "BSD": return "ConveyanceDeedBargainAndSaleDeed";
        case "LBD": return "ConveyanceDeed"; // Lady Bird Deed maps to general conveyance
        case "TOD": return "ConveyanceDeed"; // Transfer on Death maps to general conveyance
        case "SHD": return "ConveyanceDeed"; // Sheriff's Deed maps to general conveyance
        case "TXD": return "ConveyanceDeed"; // Tax Deed maps to general conveyance
        case "TRD": return "ConveyanceDeed"; // Trustee's Deed maps to general conveyance
        case "PRD": return "ConveyanceDeed"; // Personal Representative Deed maps to general conveyance
        case "CRD": return "ConveyanceDeed"; // Correction Deed maps to general conveyance
        case "DIL": return "ConveyanceDeed"; // Deed in Lieu of Foreclosure maps to general conveyance
        case "LED": return "ConveyanceDeed"; // Life Estate Deed maps to general conveyance
        case "JTD": return "ConveyanceDeed"; // Joint Tenancy Deed maps to general conveyance
        case "TCD": return "ConveyanceDeed"; // Tenancy in Common Deed maps to general conveyance
        case "CPD": return "ConveyanceDeed"; // Community Property Deed maps to general conveyance
        case "GFT": return "ConveyanceDeed"; // Gift Deed maps to general conveyance
        case "ITD": return "ConveyanceDeed"; // Interspousal Transfer Deed maps to general conveyance
        case "WLD": return "ConveyanceDeed"; // Wild Deed maps to general conveyance
        case "SMD": return "ConveyanceDeed"; // Special Master's Deed maps to general conveyance
        case "COD": return "ConveyanceDeed"; // Court Order Deed maps to general conveyance
        case "CFD": return "ConveyanceDeed"; // Contract for Deed maps to general conveyance
        case "QTD": return "ConveyanceDeed"; // Quiet Title Deed maps to general conveyance
        case "ADM": return "ConveyanceDeed"; // Administrator's Deed maps to general conveyance
        case "GAD": return "ConveyanceDeed"; // Guardian's Deed maps to general conveyance
        case "RCD": return "ConveyanceDeed"; // Receiver's Deed maps to general conveyance
        case "RWD": return "ConveyanceDeed"; // Right of Way Deed maps to general conveyance
        case "VPD": return "ConveyanceDeed"; // Vacation of Plat Deed maps to general conveyance
        case "AOC": return "AssignmentAssignmentOfContract";
        case "ROC": return "Assignment";
        default: return "ConveyanceDeedWarrantyDeed"; // Default fallback
      }
    }

    for (const s of input.SalesInfos) {
      const sales = {
        ownership_transfer_date: parseISODate(s.DateOfSale) || null,
        purchase_price_amount: s.SalePrice != null ? Number(s.SalePrice) : null,
      };
      writeJson(path.join("data", `sales_${saleIndex}.json`), sales);

      // Common Miami-Dade fields we might encounter
      const book =
        asStringOrNull(s.Book) ||
        asStringOrNull(s.OfficialRecordBook) ||
        asStringOrNull(s.DeedBook) ||
        null;
      const page =
        asStringOrNull(s.Page) ||
        asStringOrNull(s.OfficialRecordPage) ||
        asStringOrNull(s.DeedPage) ||
        null;
      const instrument =
        asStringOrNull(s.Instrument) ||
        asStringOrNull(s.InstrumentNumber) ||
        asStringOrNull(s.DocumentNumber) ||
        null;
      const saleType = asStringOrNull(s.SaleType) || asStringOrNull(s.DeedType) || asStringOrNull(s.SaleInstrument) || null;

      salesFiles.push({
        index: saleIndex,
        date: sales.ownership_transfer_date,
        book,
        page,
        instrument,
        saleType,
        EncodedRecordBookAndPage: s.EncodedRecordBookAndPage || null,
      });
      saleIndex++;
    }

    // Optional: create files when we have book/page or instrument
    /** @type {Map<number, number>} */
    const fileIndexBySale = new Map();
    let fileIdx = 1;
    for (const s of salesFiles) {
      if ((s.book && s.page) || s.instrument) {
        /** @type {{file_format:"txt",name:string,original_url:string|null,ipfs_url:null,document_type:ReturnType<typeof mapFileDocType>}} */
        const fileObj = {
          file_format: "txt",
          name: s.book && s.page
            ? `OR Book ${s.book} Page ${s.page}`
            : `Instrument ${s.instrument}`,
          // Construct Miami-Dade clerk URL using EncodedRecordBookAndPage
          original_url: s.EncodedRecordBookAndPage 
            ? `https://onlineservices.miamidadeclerk.gov/officialrecords/SearchResults?QS=${s.EncodedRecordBookAndPage}`
            : null,
          ipfs_url: null,
          document_type: mapFileDocType(s.saleType),
        };
        writeJson(path.join("data", `file_${fileIdx}.json`), fileObj);
        fileIndexBySale.set(s.index, fileIdx);
        fileIdx++;
      }
    }

    // Create deeds and map sale -> deed index
    /** @type {Map<number, number>} */
    const deedMap = new Map();
    let deedIdx = 1;
    for (const s of salesFiles) {
      const deed = {
        deed_type: mapDeedType(s.saleType),
        request_identifier: parcelIdentifier || "unknown",
        source_http_request: sourceHttpRequest
      };
      writeJson(path.join("data", `deed_${deedIdx}.json`), deed);
      deedMap.set(s.index, deedIdx);
      // relationship_property_deed (property → deed)
      const relPD = {
        to: { "/": `./deed_${deedIdx}.json` },
        from: { "/": "./property.json" },
      };
      writeJson(path.join("data", `relationship_property_deed_${deedIdx}.json`), relPD);
      deedIdx++;
    }

    // relationship_sales_deed (deed → sale)
    let relSDIdx = 1;
    for (const [sIndex, dIndex] of deedMap.entries()) {
      const relSD = {
        to: { "/": `./sales_${sIndex}.json` },
        from: { "/": `./deed_${dIndex}.json` },
      };
      writeJson(path.join("data", `relationship_sales_deed_${relSDIdx}.json`), relSD);
      relSDIdx++;
    }

    // relationship_deed_file (deed → file) when file exists for that sale
    let rdfIdx = 1;
    for (const [sIndex, dIndex] of deedMap.entries()) {
      const fIndex = fileIndexBySale.get(sIndex);
      if (!fIndex) continue;
      const relDF = {
        to: { "/": `./deed_${dIndex}.json` },
        from: { "/": `./file_${fIndex}.json` },
      };
      writeJson(path.join("data", `relationship_deed_file_${rdfIdx}.json`), relDF);
      rdfIdx++;
    }
  }

  // PERSON/COMPANY (owners)
  const ownersKey = `property_${(pInfo.FolioNumber || "").replace(/[^0-9\-]/g, "")}`; // expect 01-4103-033-0491
  const ownersPkg =
    owners[ownersKey] ||
    owners[
      `property_${(seed.parcel_id || "").replace(/(.{2})(.{4})(.{3})(.{4})/, "$1-$2-$3-$4")}`
    ] ||
    null;
  if (
    ownersPkg &&
    ownersPkg.owners_by_date &&
    Array.isArray(ownersPkg.owners_by_date.current)
  ) {
    const currentOwners = ownersPkg.owners_by_date.current;
    // choose person or company uniformly; here entries specify type
    let personCount = 0;
    let companyCount = 0;
    for (const o of currentOwners) {
      if (o.type === "person") personCount++;
      else if (o.type === "company") companyCount++;
    }

    let personIdx = 1;
    let companyIdx = 1;
    for (const o of currentOwners) {
      if (o.type === "person") {
        const person = {
          birth_date: null,
          first_name: formatNameForValidation(o.first_name),
          last_name: formatNameForValidation(o.last_name),
          middle_name: formatNameForValidation(o.middle_name),
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        writeJson(path.join("data", `person_${personIdx}.json`), person);
        personIdx++;
      } else if (o.type === "company") {
        const company = { name: o.name || null };
        writeJson(path.join("data", `company_${companyIdx}.json`), company);
        companyIdx++;
      }
    }

    // relationships for sales → owners (use latest sales_1.json if exists)
    const salesFiles = fs
      .readdirSync("data")
      .filter((f) => /^sales_\d+\.json$/.test(f))
      .sort((a, b) => {
        const ai = parseInt(a.match(/(\d+)/)[1], 10);
        const bi = parseInt(b.match(/(\d+)/)[1], 10);
        return ai - bi;
      });
    if (salesFiles.length) {
      const lastSales = salesFiles[0]; // if only last is desired; spec does not define matching by date; link available sale
      let relIdx = 1;
      let p = 1;
      while (fs.existsSync(path.join("data", `person_${p}.json`))) {
        const rel = {
          to: { "/": `./person_${p}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_person${p > 1 ? `_${p}` : ""}.json`,
          ),
          rel,
        );
        p++;
        relIdx++;
      }
      let c = 1;
      while (fs.existsSync(path.join("data", `company_${c}.json`))) {
        const rel = {
          to: { "/": `./company_${c}.json` },
          from: { "/": `./${lastSales}` },
        };
        writeJson(
          path.join(
            "data",
            `relationship_sales_company${c > 1 ? `_${c}` : ""}.json`,
          ),
          rel,
        );
        c++;
        relIdx++;
      }
    }
  }

  // UTILITY
  const utilsKey = ownersKey; // same pattern
  const utilPkg = utils[utilsKey] || null;
  if (utilPkg) {
    const utility = {
      cooling_system_type: utilPkg.cooling_system_type,
      heating_system_type: utilPkg.heating_system_type,
      public_utility_type: utilPkg.public_utility_type,
      sewer_type: utilPkg.sewer_type,
      water_source_type: utilPkg.water_source_type,
      plumbing_system_type: utilPkg.plumbing_system_type,
      plumbing_system_type_other_description:
        utilPkg.plumbing_system_type_other_description,
      electrical_panel_capacity: utilPkg.electrical_panel_capacity,
      electrical_wiring_type: utilPkg.electrical_wiring_type,
      hvac_condensing_unit_present: utilPkg.hvac_condensing_unit_present,
      electrical_wiring_type_other_description:
        utilPkg.electrical_wiring_type_other_description,
      solar_panel_present: utilPkg.solar_panel_present,
      solar_panel_type: utilPkg.solar_panel_type,
      solar_panel_type_other_description:
        utilPkg.solar_panel_type_other_description,
      smart_home_features: utilPkg.smart_home_features,
      smart_home_features_other_description:
        utilPkg.smart_home_features_other_description,
      hvac_unit_condition: utilPkg.hvac_unit_condition,
      solar_inverter_visible: utilPkg.solar_inverter_visible,
      hvac_unit_issues: utilPkg.hvac_unit_issues,
      electrical_panel_installation_date:
        utilPkg.electrical_panel_installation_date,
      electrical_rewire_date: utilPkg.electrical_rewire_date,
      hvac_capacity_kw: utilPkg.hvac_capacity_kw,
      hvac_capacity_tons: utilPkg.hvac_capacity_tons,
      hvac_equipment_component: utilPkg.hvac_equipment_component,
      hvac_equipment_manufacturer: utilPkg.hvac_equipment_manufacturer,
      hvac_equipment_model: utilPkg.hvac_equipment_model,
      hvac_installation_date: utilPkg.hvac_installation_date,
      hvac_seer_rating: utilPkg.hvac_seer_rating,
      hvac_system_configuration: utilPkg.hvac_system_configuration,
      plumbing_system_installation_date:
        utilPkg.plumbing_system_installation_date,
      sewer_connection_date: utilPkg.sewer_connection_date,
      solar_installation_date: utilPkg.solar_installation_date,
      solar_inverter_installation_date:
        utilPkg.solar_inverter_installation_date,
      solar_inverter_manufacturer: utilPkg.solar_inverter_manufacturer,
      solar_inverter_model: utilPkg.solar_inverter_model,
      water_connection_date: utilPkg.water_connection_date,
      water_heater_installation_date: utilPkg.water_heater_installation_date,
      water_heater_manufacturer: utilPkg.water_heater_manufacturer,
      water_heater_model: utilPkg.water_heater_model,
      well_installation_date: utilPkg.well_installation_date,
      plumbing_fixture_count: utilPkg.plumbing_fixture_count,
      plumbing_fixture_type_primary: utilPkg.plumbing_fixture_type_primary,
      plumbing_fixture_quality: utilPkg.plumbing_fixture_quality,
    };
    writeJson(path.join("data", "utility.json"), utility);
  }

  // LAYOUTS from owners/layout_data.json only (layout synthesis moved to layoutMapping.js)
  const layoutPkg = layouts[ownersKey] || null;
  if (layoutPkg && Array.isArray(layoutPkg.layouts)) {
    let idx = 1;
    for (const l of layoutPkg.layouts) {
      const layoutObj = {
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
        bathroom_renovation_date: l.bathroom_renovation_date ?? null,
        kitchen_renovation_date: l.kitchen_renovation_date ?? null,
        flooring_installation_date: l.flooring_installation_date ?? null,
        story_type: l.story_type ?? null,
        building_number: l.building_number ?? null,
        request_identifier: l.request_identifier ?? null,
        source_http_request: l.source_http_request ?? null,
        area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
        total_area_sq_ft: l.total_area_sq_ft ?? null,
        heated_area_sq_ft: l.heated_area_sq_ft ?? null,
        adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
      };
      writeJson(path.join("data", `layout_${idx}.json`), layoutObj);
      idx++;
    }
  }

  // STRUCTURE from input (set required to null where not provided)
  // Determine number of buildings from BuildingInfos
  let numberOfBuildings = null;
  if (input.Building && Array.isArray(input.Building.BuildingInfos)) {
    const buildingNos = new Set();
    for (const b of input.Building.BuildingInfos) {
      if (b && b.BuildingNo != null) {
        const n = Number(b.BuildingNo);
        if (Number.isFinite(n)) buildingNos.add(n);
      }
    }
    if (buildingNos.size > 0) numberOfBuildings = buildingNos.size;
  }

  const structure = {
    source_http_request: sourceHttpRequest,
    request_identifier: parcelIdentifier,
    architectural_style_type: null,
    attachment_type: pInfo && pInfo.UnitCount === 1 ? "Detached" : null,
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
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    number_of_stories:
      pInfo && pInfo.FloorCount != null ? Number(pInfo.FloorCount) : null,
    number_of_buildings: numberOfBuildings,
  };
  
  // Extract additional structure details from ExtraFeatureInfos
  // Deduplicate by description to avoid counting same feature multiple times across tax years
  const seenStructureFeatures = new Set();
  for (const ef of extraFeatureInfos) {
    const desc = ef.Description || "";
    const units = ef.Units;
    
    // Skip if we've already processed this feature
    if (seenStructureFeatures.has(desc)) {
      continue;
    }
    seenStructureFeatures.add(desc);
    
    // Extract wall material (CBS = Concrete Block System)
    if (/\bWALL\b.*\bCBS\b/i.test(desc) && !structure.exterior_wall_material_primary) {
      structure.exterior_wall_material_primary = "Concrete Block";
    }
    
    // Extract mezzanine area (add to upper story area)
    if (/\bMEZZANINE\b/i.test(desc) && units && units > 0) {
      if (!structure.finished_upper_story_area) {
        structure.finished_upper_story_area = 0;
      }
      structure.finished_upper_story_area += units;
    }
    
    // Extract interior office area (add to base area)
    if (/\bINTERIOR\s*OFFICE\b/i.test(desc) && units && units > 0) {
      if (!structure.finished_base_area) {
        structure.finished_base_area = 0;
      }
      structure.finished_base_area += units;
    }
  }
  
  writeJson(path.join("data", "structure.json"), structure);
}

try {
  main();
  console.log("Extraction complete.");
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
}
