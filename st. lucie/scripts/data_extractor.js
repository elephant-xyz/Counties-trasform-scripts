#!/usr/bin/env node
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

async function readJson(p) {
  const s = await fsp.readFile(p, "utf8");
  return JSON.parse(s);
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textClean(s) {
  // Improved textClean to remove HTML comments and non-breaking spaces more aggressively
  return (s || "")
    .replace(/<!--.*?-->/g, "") // Remove HTML comments
    .replace(/\u00a0/g, " ") // Replace non-breaking spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .trim();
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const s = String(str).replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return n;
}

function parseDateToISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeOwnerKey(name) {
  const cleaned = textClean(name);
  if (!cleaned) return "";
  return cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const COMPANY_NAME_REGEX =
  /\b(assn|association|bank|church|company|co\b|corp|corporation|enterprises|foundation|group|holdings|inc\b|investments|llc\b|llp\b|ltd\b|management|partners|partnership|properties|realty|solutions|trust)\b/i;

function guessOwnerType(name) {
  if (!name) return "person";
  return COMPANY_NAME_REGEX.test(name) ? "company" : "person";
}

function parsePersonNameTokens(name) {
  let cleaned = textClean(name);
  if (!cleaned) return null;

  // Remove common descriptors like (EST), (TR), etc.
  // This regex looks for words in parentheses that are common legal/estate terms
  cleaned = cleaned.replace(/\s*\((EST|TR|ET AL|JR|SR|II|III|IV)\)\s*/gi, ' ').trim();
  // Also remove common suffixes that might be mistaken for middle names or part of the last name
  cleaned = cleaned.replace(/,?\s*(JR|SR|II|III|IV)\.?$/i, '').trim();


  if (cleaned.includes(",")) {
    const [lastPart, rest] = cleaned.split(",", 2);
    const restTokens = textClean(rest)
      .split(/\s+/)
      .filter(Boolean);
    if (restTokens.length === 0) {
      return {
        first_name: null,
        middle_name: null,
        last_name: textClean(lastPart) || null,
      };
    }
    const first = restTokens[0] || null;
    const middle =
      restTokens.length > 1 ? restTokens.slice(1).join(" ") : null;
    return {
      first_name: first || null,
      middle_name: middle || null,
      last_name: textClean(lastPart) || null,
    };
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { first_name: null, middle_name: null, last_name: null };
  }
  if (tokens.length === 1) {
    return { first_name: tokens[0], middle_name: null, last_name: null };
  }
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle =
    tokens.length > 2 ? tokens.slice(1, -1).join(" ") || null : null;

  // Validate middle name against the pattern if it exists
  const middleNamePattern = /^[A-Z][a-zA-Z\s\-',.]*$/;
  const validatedMiddle = (middle && middleNamePattern.test(middle)) ? middle : null;

  return {
    first_name: first || null,
    middle_name: validatedMiddle, // Use the validated middle name
    last_name: last || null,
  };
}

function buildPersonDisplayName(person) {
  if (!person) return null;
  const parts = [
    person.first_name,
    person.middle_name,
    person.last_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function slugify(value, fallback = "unspecified") {
  if (!value || typeof value !== "string") return fallback;
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const trimmed = cleaned.replace(/^_+|_+$/g, "");
  return trimmed || fallback;
}

function detectMultiRequest(inputObj) {
  if (!inputObj || typeof inputObj !== "object") return false;
  const keys = Object.keys(inputObj);
  if (keys.length === 0) return false;
  return keys.some(
    (k) =>
      inputObj[k] &&
      typeof inputObj[k] === "object" &&
      inputObj[k].source_http_request &&
      inputObj[k].response,
  );
}

function getFileFormatFromUrl(u) {
  if (!u) return null;
  const m = u.toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/);
  if (!m) return null;
  const ext = m[1];
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  // Removed "pdf" as it's not in the schema's enum for file_format
  return null; // other extensions => null per schema enum
}

function extractDeedReference(rawText, rawUrl) {
  const details = {
    book: null,
    page: null,
    volume: null,
    instrument_number: null,
  };

  const assignIfMissing = (key, value) => {
    if (value == null) return;
    const trimmed = textClean(String(value));
    if (!trimmed) return;
    if (details[key] == null) details[key] = trimmed;
  };

  if (rawUrl) {
    try {
      const url = new URL(rawUrl, "https://placeholder.local/");
      const segments = url.pathname.split("/").filter(Boolean);
      const lowerSegments = segments.map((s) => s.toLowerCase());
      const docIdx = lowerSegments.indexOf("getdocumentbybookpage");
      if (docIdx !== -1) {
        const after = segments.slice(docIdx + 1);
        if (after.length >= 1) assignIfMissing("volume", after[0]);
        if (after.length >= 2) assignIfMissing("book", after[1]);
        if (after.length >= 3) assignIfMissing("page", after[2]);
      }
      for (const [key, value] of url.searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("instrument") ||
          (lowerKey.includes("document") && lowerKey.includes("number")) ||
          lowerKey.includes("record")
        ) {
          assignIfMissing("instrument_number", value);
          break;
        }
      }
    } catch (err) {
      // Ignore malformed URLs; fall back to text extraction.
    }
  }

  const text = textClean(rawText);
  if (text) {
    const slashMatch = text.match(/([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)/);
    if (slashMatch) {
      assignIfMissing("book", slashMatch[1]);
      assignIfMissing("page", slashMatch[2]);
      if (slashMatch.index != null && slashMatch.index > 0 && details.volume == null) {
        const prefix = text.slice(0, slashMatch.index).replace(/[-:,]?\s*$/, "");
        if (prefix && !/book|page|inst/i.test(prefix)) assignIfMissing("volume", prefix);
      }
    }

    const bookMatch = text.match(/book\s*[:#-]?\s*([A-Za-z0-9]+)/i);
    if (bookMatch) assignIfMissing("book", bookMatch[1]);

    const pageMatch = text.match(/page\s*[:#-]?\s*([A-Za-z0-9]+)/i);
    if (pageMatch) assignIfMissing("page", pageMatch[1]);

    const volumeMatch = text.match(/vol(?:ume)?\s*[:#-]?\s*([A-Za-z0-9]+)/i);
    if (volumeMatch) assignIfMissing("volume", volumeMatch[1]);

    const instrumentMatch = text.match(
      /(?:inst(?:r(?:ument)?)?|doc(?:ument)?|record(?:ing)?|clerk)\s*(?:no\.?|number|#|:)?\s*([A-Za-z0-9\-\/]+)/i,
    );
    if (instrumentMatch) assignIfMissing("instrument_number", instrumentMatch[1]);
  }

  return details;
}

function mapImprovementType(permitNumber, description) {
  const desc = textClean(description).toLowerCase();
  const prefix = (permitNumber || "").split("-")[0]?.toUpperCase() || "";

  if (desc.includes("new construction") || desc.includes("new home")) {
    return "ResidentialConstruction";
  }
  if (desc.includes("electric")) return "Electrical";
  if (desc.includes("plumb")) return "Plumbing";
  if (desc.includes("air conditioning") || desc.includes("hvac") || desc.includes("mechanical")) {
    return "MechanicalHVAC";
  }
  if (desc.includes("roof")) return "Roofing";
  if (desc.includes("pool") || desc.includes("spa")) return "PoolSpaInstallation";
  if (desc.includes("demolition") || desc.includes("demo")) return "Demolition";
  if (desc.includes("addition")) return "BuildingAddition";
  if (desc.includes("fence")) return "Fencing";
  if (desc.includes("window") || desc.includes("door") || desc.includes("shutter") || desc.includes("finish")) {
    return "ExteriorOpeningsAndFinishes";
  }

  switch (prefix) {
    case "BLDR":
    case "BLDG":
    case "RES":
      return "ResidentialConstruction";
    case "ELER":
    case "ELEC":
      return "Electrical";
    case "PLMR":
    case "PLMB":
      return "Plumbing";
    case "MECR":
    case "MECH":
      return "MechanicalHVAC";
    case "ROOFR":
    case "ROOF":
      return "Roofing";
    case "POOL":
    case "SPAS":
      return "PoolSpaInstallation";
    default:
      return null;
  }
}

function mapImprovementAction(description) {
  const desc = textClean(description).toLowerCase();
  if (!desc) return null;
  if (desc.includes("new")) return "New";
  if (desc.includes("repair")) return "Repair";
  if (desc.includes("replace") || desc.includes("re-roof") || desc.includes("reroof")) {
    return "Replacement";
  }
  if (desc.includes("addition") || desc.includes("add ")) return "Addition";
  if (desc.includes("demo") || desc.includes("demolition") || desc.includes("remove")) {
    return "Remove";
  }
  return null;
}

async function removeExisting(pattern) {
  try {
    const files = await fsp.readdir("data");
    const targets = files.filter((f) => pattern.test(f));
    await Promise.all(
      targets.map((f) => fsp.unlink(path.join("data", f)).catch(() => {})),
    );
  } catch {}
}

const propertyTypeMapping = [
  {
    "st_lucie_property_type": "0000 - Vac Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0004 - Vac Res-Cond",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0005 - Vac Res Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0100 - Single Family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "st_lucie_property_type": "0101 - SingleFam TH (Townhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Townhouse"
  },
  {
    "st_lucie_property_type": "0105 - SingFam-Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0200 - Mobile Homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "MobileHome"
  },
  {
    "st_lucie_property_type": "0205 - MobHome-Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0300 - M-F >= 10U (Multi-Family >= 10 Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "st_lucie_property_type": "0400 - Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Condominium"
  },
  {
    "st_lucie_property_type": "0425 - Time Share",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Timeshare"
  },
  {
    "st_lucie_property_type": "0500 - Cooperatives",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0700 - Misc Res (Miscellaneous Residential)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "MiscellaneousResidential"
  },
  {
    "st_lucie_property_type": "0800 - M-F < 10U (Multi-Family < 10 Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyLessThan10"
  },
  {
    "st_lucie_property_type": "0900 - ResCommonElemnt (Residential Common Element)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "ResidentialCommonElementsAreas"
  },
  {
    "st_lucie_property_type": "1000 - Vac Comm (Vacant Commercial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1004 - Vac Com Cond (Vacant Commercial Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1009 - Vac Comm (Vacant Commercial - duplicate entry, possibly a typo or specific sub-category)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1100 - STOR-1STR (Store - 1 Story)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1104 - Store Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1200 - MX-STR OFCE (Mixed Store/Office)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1300 - DEPT STORE (Department Store)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1304 - DeptSt_Condo (Department Store Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1400 - SUPMARKET (Supermarket)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1600 - COM SHOP CNT (Community Shopping Center)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1700 - OFCE BLDG (Office Building)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1704 - OFFICE CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1800 - OFCE BLDG (Office Building - duplicate entry, possibly a typo or specific sub-category)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1900 - PROF SERV (Professional Services)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1904 - MED CONDO (Medical Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2000 - AIRPT/MARINA (Airport/Marina)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2100 - REST CAF (Restaurant/Cafe)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2104 - REST CONDO (Restaurant Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2200 - DRV IN REST (Drive-In Restaurant)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2204 - DRV IN Condo (Drive-In Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2300 - FIN INST (Financial Institution)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2500 - RPR SRVC SHO (Repair Service Shop)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2502 - Dry Cleaner/Laundromat",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2600 - SRVC STAT (Service Station)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2603 - Car Wash",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2700 - AUTO SALS (Auto Sales)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2800 - PRKG/MOBILE (Parking/Mobile)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHomePark",
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "3000 - FLRT GRNHSE (Florist/Greenhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3200 - ENC THETHRS (Enclosed Theaters)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3300 - NgtClub Bars (Nightclub/Bars)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3400 - BWLNG ALYS (Bowling Alleys)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3500 - TRST ATRCT (Tourist Attraction)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3800 - GLF CRSES (Golf Courses)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3900 - HTLS MTLS (Hotels/Motels)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3904 - Hotel-Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "4000 - VCNT INDUS (Vacant Industrial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "4100 - LGHT MNFCT (Light Manufacturing)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4200 - HVY INDSTRL (Heavy Industrial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4300 - LMBR YRD (Lumber Yard)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4400 - PCKNG PLNTS (Packing Plants)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4500 - CANRIS FRT (Canneries/Fruit)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4600 - OTHR FOOD (Other Food Processing)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4700 - MNRAL (Mineral)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4800 - WRHSNG DIST (Warehousing/Distribution)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4804 - INDUS CONDO (Industrial Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "4820 - INDMINIWHS (Industrial Mini-Warehouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4900 - OPN STRGE (Open Storage)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "5100 - CRPLD SL CAP (Cropland Soil Capability)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "5400 - TMBL STE (Timberland)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6000 - GRZNG SLD CP (Grazing Soil Capability)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6600 - ORCHRD GRV (Orchard/Grove)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6700 - MISC AG TYPES (Miscellaneous Agricultural Types)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6900 - NURSERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7000 - VAC INST (Vacant Institutional)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "7100 - CHRCHS (Churches)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7200 - PRVTE SCHLS (Private Schools)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7300 - PRVTE HOSP (Private Hospitals)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7400 - HMS AGED (Homes for the Aged)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7500 - Orph/Non Prf (Orphanage/Non-Profit)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7502 - Rehab Living Facility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7600 - MRTURIES (Mortuaries)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7700 - CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7704 - HOA Clubhous (Homeowners Association Clubhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7900 - CLTRAL ORGA (Cultural Organization)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8000 - VAC GOVT (Vacant Government)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "8100 - MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8200 - FRST PRKS (Forest/Parks)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "8300 - PBL CTY SCH (Public City School)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8400 - COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8500 - HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8600 - COUNTIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8700 - STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8800 - FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8900 - Mncpal Prop (Municipal Property)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "9000 - LSHLD INTER (Leasehold Interest)",
    "ownership_estate_type": "Leasehold",
    "build_status": null,
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9100 - UTLTY (Utility)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9200 - MINING LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9300 - SBSRFCE RGHT (Subsurface Rights)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "9400 - R/W ST RDS,DITCH,IRRIGTN (Right-of-Way, State Roads, Ditch, Irrigation)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "9500 - RVRS, LKS,SUBMRGED (Rivers, Lakes, Submerged)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9600 - WASTELANDS,MARSH,DUNES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9700 - OTDR RCRTNL (Outdoor Recreational)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9800 - CNTRLY ASSED (Centrally Assessed)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9900 - Non-Ag ACRG (Non-Agricultural Acreage)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "VacantLand"
  }
];

const PROPERTY_TYPE_ENUM = new Set([
  "LandParcel",
  "Building",
  "Unit",
  "ManufacturedHome",
]);

const LEGACY_PROPERTY_TYPE_TO_ELEPHANT = Object.freeze({
  LandParcel: "LandParcel",
  VacantLand: "LandParcel",
  ResidentialCommonElementsAreas: "LandParcel",
  SingleFamily: "Building",
  Townhouse: "Building",
  MiscellaneousResidential: "Building",
  MultiFamilyMoreThan10: "Building",
  MultiFamilyLessThan10: "Building",
  Building: "Building",
  Condominium: "Unit",
  Cooperative: "Unit",
  Timeshare: "Unit",
  Unit: "Unit",
  MobileHome: "ManufacturedHome",
  ManufacturedHome: "ManufacturedHome",
});

const STRUCTURE_FORM_ENUM = new Set([
  "SingleFamilyDetached",
  "SingleFamilySemiDetached",
  "TownhouseRowhouse",
  "Duplex",
  "Triplex",
  "Quadplex",
  "MultiFamily5Plus",
  "ApartmentUnit",
  "Loft",
  "ManufacturedHomeOnLand",
  "ManufacturedHomeInPark",
  "MultiFamilyMoreThan10",
  "MultiFamilyLessThan10",
  "MobileHome",
  "ManufacturedHousingMultiWide",
  "ManufacturedHousing",
  "ManufacturedHousingSingleWide",
  "Modular",
]);

const BUILD_STATUS_ENUM = new Set(["VacantLand", "Improved", "UnderConstruction"]);

const OWNERSHIP_ESTATE_ENUM = new Set([
  "Condominium",
  "Cooperative",
  "LifeEstate",
  "Timeshare",
  "OtherEstate",
  "FeeSimple",
  "Leasehold",
  "RightOfWay",
  "NonWarrantableCondo",
  "SubsurfaceRights",
]);

const PROPERTY_USAGE_ENUM = new Set([
  "Residential",
  "Commercial",
  "Industrial",
  "Agricultural",
  "Recreational",
  "Conservation",
  "Retirement",
  "ResidentialCommonElementsAreas",
  "DrylandCropland",
  "HayMeadow",
  "CroplandClass2",
  "CroplandClass3",
  "TimberLand",
  "GrazingLand",
  "OrchardGroves",
  "Poultry",
  "Ornamentals",
  "Church",
  "PrivateSchool",
  "PrivateHospital",
  "HomesForAged",
  "NonProfitCharity",
  "MortuaryCemetery",
  "ClubsLodges",
  "SanitariumConvalescentHome",
  "CulturalOrganization",
  "Military",
  "ForestParkRecreation",
  "PublicSchool",
  "PublicHospital",
  "GovernmentProperty",
  "RetailStore",
  "DepartmentStore",
  "Supermarket",
  "ShoppingCenterRegional",
  "ShoppingCenterCommunity",
  "OfficeBuilding",
  "MedicalOffice",
  "TransportationTerminal",
  "Restaurant",
  "FinancialInstitution",
  "ServiceStation",
  "AutoSalesRepair",
  "MobileHomePark",
  "WholesaleOutlet",
  "Theater",
  "Entertainment",
  "Hotel",
  "RaceTrack",
  "GolfCourse",
  "LightManufacturing",
  "HeavyManufacturing",
  "LumberYard",
  "PackingPlant",
  "Cannery",
  "MineralProcessing",
  "Warehouse",
  "OpenStorage",
  "Utility",
  "RiversLakes",
  "SewageDisposal",
  "Railroad",
  "TransitionalProperty",
  "ReferenceParcel",
  "NurseryGreenhouse",
  "AgriculturalPackingFacility",
  "LivestockFacility",
  "Aquaculture",
  "VineyardWinery",
  "DataCenter",
  "TelecommunicationsFacility",
  "SolarFarm",
  "WindFarm",
  "NativePasture",
  "ImprovedPasture",
  "Rangeland",
  "PastureWithTimber",
  "Unknown",
]);

function coerceEnum(value, allowedSet) {
  if (value == null) return null;
  return allowedSet.has(value) ? value : null;
}

function normalizePropertyMapping(rawMapping) {
  if (!rawMapping || typeof rawMapping !== "object") return {};

  const normalized = { ...rawMapping };

  normalized.ownership_estate_type = coerceEnum(
    normalized.ownership_estate_type,
    OWNERSHIP_ESTATE_ENUM,
  );

  normalized.build_status = coerceEnum(
    normalized.build_status,
    BUILD_STATUS_ENUM,
  );

  normalized.structure_form = coerceEnum(
    normalized.structure_form,
    STRUCTURE_FORM_ENUM,
  );

  normalized.property_usage_type = coerceEnum(
    normalized.property_usage_type,
    PROPERTY_USAGE_ENUM,
  );

  const legacyType = normalized.property_type;
  if (legacyType == null) {
    normalized.property_type = null;
  } else if (PROPERTY_TYPE_ENUM.has(legacyType)) {
    normalized.property_type = legacyType;
  } else if (Object.prototype.hasOwnProperty.call(LEGACY_PROPERTY_TYPE_TO_ELEPHANT, legacyType)) {
    normalized.property_type =
      LEGACY_PROPERTY_TYPE_TO_ELEPHANT[legacyType] || null;
  } else {
    normalized.property_type = null;
  }

  return normalized;
}

function mapPropertyType(stLuciePropertyType) {
  // Extract only the number part from the st_lucie_property_type string
  const codeMatch = stLuciePropertyType ? stLuciePropertyType.match(/^(\d{4})/) : null;
  const code = codeMatch ? codeMatch[1] : null;

  if (!code) return {}; // Return empty object if no code found

  // Find mapping by matching the extracted code with the start of the mapping's st_lucie_property_type
  const mapping = propertyTypeMapping.find(
    (item) => item.st_lucie_property_type.startsWith(code)
  );
  return normalizePropertyMapping(mapping);
}

async function main() {
  ensureDirSync("data");
  await removeExisting(/^error\.json$/);

  const inputHtmlRaw = await fsp.readFile("input.html", "utf8");

  let inputAsJson = null;
  try {
    inputAsJson = JSON.parse(inputHtmlRaw);
  } catch {}
  const isMulti = detectMultiRequest(inputAsJson);

  // Initialize cheerio here, before any potential usage
  const $ = isMulti ? null : cheerio.load(inputHtmlRaw);

  // Removed addressPath and parcelPath as input files
  const ownersDir = "owners";
  const ownerDataPath = path.join(ownersDir, "owner_data.json");
  const utilitiesDataPath = path.join(ownersDir, "utilities_data.json");
  const layoutDataPath = path.join(ownersDir, "layout_data.json");
  const structureDataPath = path.join(ownersDir, "structure_data.json");
  const unnormalizedAddressPath = "unnormalized_address.json";
  const propertySeedPath = "property_seed.json"; // Added property_seed.json

  // Removed readJson(addressPath) and readJson(parcelPath)
  const ownerData = await readJson(ownerDataPath).catch(() => null);
  const utilitiesData = await readJson(utilitiesDataPath).catch(() => null);
  const layoutData = await readJson(layoutDataPath).catch(() => null);
  const structureData = await readJson(structureDataPath).catch(() => null);
  const unnormalizedAddressData = await readJson(unnormalizedAddressPath).catch(() => null);
  const propertySeedData = await readJson(propertySeedPath).catch(() => null); // Read property_seed.json

  // Base data for address output, derived from property_seed or unnormalized_address
  // Ensure source_http_request is taken from property_seed if available, otherwise unnormalized_address
  const baseRequestData = propertySeedData || unnormalizedAddressData || {};
  const sourceHttpRequest = baseRequestData.source_http_request || null;
  const sourceHttpRequestUrl = sourceHttpRequest ? sourceHttpRequest.url : null;

  await removeExisting(/^property_improvement_.*\.json$/);
  await removeExisting(/^relationship_property_has_property_improvement_.*\.json$/);
  const propertyImprovementRecords = [];


  // --- Address extraction ---
  let siteAddress = null;
  let secTownRange = null;
  let jurisdiction = null;
  let parcelIdentifierDashed = null; // Also extract parcel ID from HTML

  // Declare these variables at a higher scope
  let township = null;
  let range = null;
  let section = null;

  if (!isMulti) {
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Site Address/i.test(th)) {
        siteAddress = textClean($(tr).find("td").text());
      } else if (/Sec\/Town\/Range/i.test(th)) {
        secTownRange = textClean($(tr).find("td").text());
      } else if (/Jurisdiction/i.test(th)) {
        jurisdiction = textClean($(tr).find("td").text());
      } else if (/Parcel ID/i.test(th)) {
        parcelIdentifierDashed = textClean($(tr).find("td").text());
      }
    });
  }

  let finalAddressOutput = {
    source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
    request_identifier: baseRequestData.request_identifier || null,
    county_name:"St. Lucie",
    latitude: unnormalizedAddressData ? unnormalizedAddressData.latitude ?? null : null,
    longitude: unnormalizedAddressData ? unnormalizedAddressData.longitude ?? null : null,
    // Initialize all structured fields to null as per schema
    city_name: null,
    country_code: null,
    postal_code: null,
    plus_four_postal_code: null,
    state_code: null,
    street_number: null,
    street_name: null,
    street_post_directional_text: null,
    street_pre_directional_text: null,
    street_suffix_type: null,
    unit_identifier: null,
    route_number: null,
    township: null, // Now correctly referenced
    range: null,    // Now correctly referenced
    section: null,  // Now correctly referenced
    block: null,
  };

  if (siteAddress && siteAddress.toLowerCase() !== "tbd") {
    // Use unnormalizedAddressData.full_address for city, state, zip if available,
    // otherwise try to parse from siteAddress.
    let cityStateZipPart = null;
    if (unnormalizedAddressData && unnormalizedAddressData.full_address) {
      const parts = unnormalizedAddressData.full_address.split(',');
      if (parts.length > 1) {
        cityStateZipPart = parts.slice(1).join(',').trim();
      }
    } else {
      const parts = siteAddress.split(',');
      if (parts.length > 1) {
        cityStateZipPart = parts.slice(1).join(',').trim();
      }
    }

    let streetNumber = null;
    let streetPreDirectionalText = null;
    let streetName = null;
    let streetSuffixType = null;
    let streetPostDirectionalText = null;
    let city_name = null;
    let state_code = null;
    let postal_code = null;
    let plus_four_postal_code = null;

    // Parse street number, pre-directional, street name, post-directional, suffix from siteAddress
    // Example: "1133 SW INGRASSINA AVE"
    const streetPartMatch = siteAddress.match(/^(\d+)\s+((?:N|S|E|W|NE|NW|SE|SW)\s+)?(.+?)(?:\s+([A-Z]{2,}))?$/i);

    if (streetPartMatch) {
      streetNumber = streetPartMatch[1];
      streetPreDirectionalText = streetPartMatch[2] ? streetPartMatch[2].trim().toUpperCase() : null;
      let tempStreetName = streetPartMatch[3].trim();
      let potentialSuffixOrPostDirectional = streetPartMatch[4] ? streetPartMatch[4].toUpperCase() : null;

      // Common street suffix types (can be expanded)
      const suffixMap = {
        "ST": "St", "AVE": "Ave", "RD": "Rd", "DR": "Dr", "BLVD": "Blvd",
        "LN": "Ln", "CT": "Ct", "CIR": "Cir", "PL": "Pl", "WAY": "Way",
        "TER": "Ter", "PKWY": "Pkwy", "HWY": "Hwy", "SQ": "Sq", "TRL": "Trl",
        "ALY": "Aly", "CV": "Cv", "EXPY": "Expy", "FRY": "Fry", "JCT": "Jct",
        "MTN": "Mtn", "OVAL": "Oval", "PASS": "Pass", "PIKE": "Pike",
        "PLZ": "Plz", "PT": "Pt", "RMP": "Ramp", "RDG": "Rdg", "RIV": "Riv",
        "ROW": "Row", "RTE": "Rte", "SHR": "Shr", "SPG": "Spg", "SPUR": "Spur",
        "UN": "Un", "VIS": "Vis", "VW": "Vw", "XING": "Xing", "EXT": "Ext",
        "GLN": "Gln", "GRN": "Grn", "HTS": "Hts", "IS": "Is", "LNDG": "Lndg",
        "LGT": "Lgt", "LCK": "Lck", "MDW": "Mdw", "MNR": "Mnr", "PR": "Pr",
        "TRCE": "Trce", "VLG": "Vlg", "WLS": "Wls", "WALK": "Walk", "COR": "Cor",
        "FRK": "Frk", "FRD": "Frd", "BRG": "Brg", "BRK": "Brk", "CLF": "Clf",
        "CYN": "Cyn", "DL": "Dl", "DM": "Dm", "FLT": "Flt", "FLD": "Fld",
        "FRST": "Frst", "GRV": "Grv", "HBR": "Hbr", "HL": "Hl", "HVN": "Hvn",
        "INLT": "Inlt", "KY": "Ky", "LF": "Lf", "LOOP": "Loop", "MALL": "Mall",
        "ML": "Ml", "NCK": "Nck", "ORCH": "Orch", "PSGE": "Psge", "RADL": "Radl",
        "RPD": "Rpd", "RST": "Rst", "SHL": "Shl", "SKWY": "Skwy", "SMT": "Smt",
        "STRA": "Stra", "STRM": "Strm", "TRFY": "Trfy", "TUNL": "Tunl",
        "VLY": "Vly", "WALL": "Wall", "BYU": "Byu", "CPE": "Cpe", "CRK": "Crk",
        "CRSE": "Crse", "CRST": "Crst", "DV": "Dv", "FALL": "Fall", "FT": "Ft",
        "GTWY": "Gtwy", "LKS": "Lks", "LODG": "Ldg", "MWS": "Mews", "OPAS": "Opas",
        "UPAS": "Upas", "PNE": "Pne", "RUN": "Run", "SPS": "Spgs", "SPUR": "Spur",
        "TRLR": "Trlr", "TRWY": "Trwy", "VIA": "Via", "XRD": "Xrd", "BCH": "Bch",
        "BGS": "Bgs", "BLF": "Blf", "BTM": "Btm", "CLB": "Clb", "CMN": "Cmn",
        "CTS": "Cts", "DLS": "Dls", "DRS": "Drs", "EST": "Est", "FLS": "Fls",
        "FRDS": "Frds", "FRGS": "Frgs", "GDNS": "Gdns", "GLNS": "Glns",
        "GRNS": "Grns", "GRVS": "Grvs", "HBRS": "Hbrs", "HLS": "Hls",
        "HVNS": "Hvns", "INLTS": "Inlts", "KNL": "Knl", "KNLS": "Knls",
        "KYS": "Kys", "LGS": "Lgs", "LGTS": "Lgts", "LCKS": "Lcks",
        "MDWS": "Mdw", "MLS": "Mls", "MNRS": "Mnr",
        "MTNS": "Mtns", "NWS": "Nws", "PLNS": "Plns", "PNES": "Pnes", "PRTS": "Prts",
        "PTS": "Pt", "RDGS": "Rdgs", "RPDS": "Rpds", "SHLS": "Shl",
        "SHRS": "Shrs", "SPS": "Spgs", "SQS": "Sqs", "STS": "Sts",
        "TRLS": "Trls", "VLS": "Vls", "VLGS": "Vlgs", "VWS": "Vws",
        "WLS": "Wls", "WAYS": "Ways", "XRDS": "Xrds", "BYP": "Byp", "CMNS": "Cmns",
        "CRKS": "Crks", "CRSS": "Crss",
        "EXPS": "Exps", "FRYS": "Frys", "GTWYS": "Gtwys", "JCTS": "Jct",
        "MTWYS": "Mtwys", "PKWYS": "Pkwys", "PLZS": "Plzs", "RMPS": "Rmps",
        "RDGS": "Rdgs", "RIVS": "Rivs", "ROWS": "Rows", "RTES": "Rtes",
        "SHRS": "Shrs", "SPS": "Spgs", "SQS": "Sqs", "STS": "Sts",
        "TRLS": "Trls", "VLS": "Vls", "VLGS": "Vlgs", "VWS": "Vws",
        "WLS": "Wls", "WAYS": "Ways", "XRDS": "Xrds"
      };

      let foundSuffix = false;
      if (potentialSuffixOrPostDirectional) {
        if (suffixMap[potentialSuffixOrPostDirectional]) {
          streetSuffixType = suffixMap[potentialSuffixOrPostDirectional];
          foundSuffix = true;
        } else if (["N", "S", "E", "W", "NE", "NW", "SE", "SW"].includes(potentialSuffixOrPostDirectional)) {
          streetPostDirectionalText = potentialSuffixOrPostDirectional;
        }
      }
      streetName = tempStreetName;
    }

    // Parse city, state, zip from cityStateZipPart
    if (cityStateZipPart) {
      const cityStateZipMatch = cityStateZipPart.match(/^([\w\s\-\']+),\s*([A-Z]{2})\s+(\d{5})(?:-(\d{4}))?$/i);
      if (cityStateZipMatch) {
        city_name = cityStateZipMatch[1].toUpperCase();
        state_code = cityStateZipMatch[2].toUpperCase();
        postal_code = cityStateZipMatch[3];
        plus_four_postal_code = cityStateZipMatch[4] || null;
      }
    }

    // Parse Sec/Town/Range
    // Sample: "25/37S/39E"
    if (secTownRange) { // This block is now correctly using the declared variables
      const strMatch = secTownRange.match(/^(\d+)\/(\d+[NS])\/(\d+[EW])$/i);
      if (strMatch) {
        section = strMatch[1];
        township = strMatch[2];
        range = strMatch[3];
      }
    }

    // Populate finalAddressOutput with parsed structured data
    finalAddressOutput.city_name = city_name;
    finalAddressOutput.country_code = "US"; // Assuming US for now
    finalAddressOutput.postal_code = postal_code;
    finalAddressOutput.plus_four_postal_code = plus_four_postal_code;
    finalAddressOutput.state_code = state_code;
    finalAddressOutput.street_number = streetNumber;
    finalAddressOutput.street_name = streetName;
    finalAddressOutput.street_post_directional_text = streetPostDirectionalText;
    finalAddressOutput.street_pre_directional_text = streetPreDirectionalText;
    finalAddressOutput.street_suffix_type = streetSuffixType;
    finalAddressOutput.township = township; // Now correctly referenced
    finalAddressOutput.range = range;    // Now correctly referenced
    finalAddressOutput.section = section;  // Now correctly referenced
    // unit_identifier, route_number, block remain null as they are not in the sample HTML
  }
  // We are explicitly NOT adding unnormalized_address.

  await fsp.writeFile(
    path.join("data", "address.json"),
    JSON.stringify(finalAddressOutput, null, 2),
  );

  // --- Parcel extraction ---
  // parcelIdentifierDashed is already extracted from HTML
  const parcelOut = {
    source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
    request_identifier: baseRequestData.request_identifier || null,
    parcel_identifier: parcelIdentifierDashed || null,
  };
  await fsp.writeFile(
    path.join("data", "parcel.json"),
    JSON.stringify(parcelOut, null, 2),
  );

  // --- Property extraction ---
  let propertyOut = null;
  if (!isMulti) {
    // Legal description
    let legalDescription = null;
    const legalSectionDiv = $("article#property-identification .section-title")
      .filter((i, el) => /Legal Description/i.test(textClean($(el).text())))
      .first();
    if (legalSectionDiv && legalSectionDiv.length) {
      const p = legalSectionDiv.next(".bottom-text").find("p").first();
      legalDescription = textClean(p.text());
    }

    // Zoning
    let zoningVal = null;
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      if (/Zoning/i.test(th)) zoningVal = td;
    });

    // Land Use Code
    let landUseCodeText = null;
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      if (/Land Use Code/i.test(th))
        landUseCodeText = td;
    });

    // Building Type from HTML (This is not directly used in the mapping, but kept for completeness if needed elsewhere)
    let buildingType = null;
    $("article#building-info table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      if (/Building Type/i.test(th)) {
        buildingType = td;
      }
    });

    const mappedPropertyDetails = mapPropertyType(landUseCodeText);

    // Number of Units
    let numberOfUnits = null;
    $("article#building-info table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Number of Units/i.test(th)) {
        const v = textClean($(tr).find("td").text());
        const n = parseInt(v.replace(/[^0-9\-]/g, ""), 10);
        if (!isNaN(n)) numberOfUnits = n;
      }
    });

    // Areas from Total Areas table
    let landAcres = null;
    let landSqft = null;
    $(
      "article#property-identification .area-container table.container tr",
    ).each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      if (/Land Size \(acres\)/i.test(th)) landAcres = td || null;
      if (/Land Size \(SF\)/i.test(th)) landSqft = td || null;
    });

    propertyOut = {
      source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
      request_identifier: baseRequestData.request_identifier || null,
      parcel_identifier: parcelIdentifierDashed || null, // Use the extracted parcel ID
      property_legal_description_text: legalDescription || null,
      property_type: mappedPropertyDetails.property_type || "LandParcel", // Default if not found
      property_usage_type: mappedPropertyDetails.property_usage_type || null,
      zoning: zoningVal || null,
      number_of_units: typeof numberOfUnits === "number" ? numberOfUnits : null,
      build_status: mappedPropertyDetails.build_status || "VacantLand",
      area_under_air: null,
      livable_floor_area: null,
      total_area: null,
      subdivision: null,
      structure_form: mappedPropertyDetails.structure_form || null,
      ownership_estate_type: mappedPropertyDetails.ownership_estate_type || null,
      property_structure_built_year: null,
      property_effective_built_year: null,
      historic_designation: false,
    };

    await fsp.writeFile(
      path.join("data", "property.json"),
      JSON.stringify(propertyOut, null, 2),
    );

    // Lot data
    const lotOut = {
      source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
      request_identifier: baseRequestData.request_identifier || null,
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
    if (landAcres) {
      const n = Number(String(landAcres).replace(/[^0-9.\-]/g, ""));
      if (isFinite(n)) lotOut.lot_size_acre = n;
    }
    if (landSqft) {
      const n = Number(String(landSqft).replace(/[^0-9.\-]/g, ""));
      if (isFinite(n)) lotOut.lot_area_sqft = Math.round(n);
    }
    await fsp.writeFile(
      path.join("data", "lot.json"),
      JSON.stringify(lotOut, null, 2),
    );

    const permitRows = $("article#permit-info table tbody tr").toArray();
    let propertyImprovementIdx = 0;
    for (const row of permitRows) {
      const cells = $(row).find("th, td");
      if (!cells || cells.length === 0) continue;

      const permitNumber = textClean($(cells[0]).text());
      const issueDateText = textClean($(cells[1]).text());
      const descriptionText = textClean($(cells[2]).text());

      if (!permitNumber && !issueDateText && !descriptionText) continue;

      propertyImprovementIdx += 1;
      const improvementFile = `property_improvement_${propertyImprovementIdx}.json`;
      const permitIssueDate = parseDateToISO(issueDateText);
      const improvementType = mapImprovementType(permitNumber, descriptionText);
      const improvementAction = mapImprovementAction(descriptionText);

      const improvementOut = {
        source_http_request: sourceHttpRequest,
        request_identifier: baseRequestData.request_identifier || null,
        permit_number: permitNumber || null,
        permit_issue_date: permitIssueDate || null,
        permit_close_date: null,
        completion_date: null,
        final_inspection_date: null,
        application_received_date: null,
        improvement_type: improvementType || null,
        improvement_action: improvementAction || null,
        improvement_status: null,
        contractor_type: null,
        is_disaster_recovery: null,
        is_owner_builder: null,
        private_provider_inspections: null,
        private_provider_plan_review: null,
        permit_required: true,
      };

      await fsp.writeFile(
        path.join("data", improvementFile),
        JSON.stringify(improvementOut, null, 2),
      );

      propertyImprovementRecords.push({
        index: propertyImprovementIdx,
        file: improvementFile,
      });
    }
  }

  // --- Ownership and Sales Extraction ---
  const sales = [];
  let fileIdx = 0;

  if (!isMulti) {
    const ownerRecords = new Map();
    const ownerAliasToId = new Map();
    let ownerRecordSerial = 0;
    const ownerPropertyRoles = new Map();
    const currentOwnerRecordIds = new Set();
    const currentOwnerRecordsList = [];

    function getOwnerRecordByAlias(alias) {
      const key = normalizeOwnerKey(alias);
      if (!key) return null;
      const recordId = ownerAliasToId.get(key);
      if (!recordId) return null;
      return ownerRecords.get(recordId) || null;
    }

    function registerAlias(record, alias) {
      if (!record || !alias) return;
      const key = normalizeOwnerKey(alias);
      if (!key) return;
      if (!ownerAliasToId.has(key)) {
        ownerAliasToId.set(key, record.id);
      }
      record.aliases.add(key);
      if (!record.displayName) record.displayName = textClean(alias) || record.displayName;
    }

    function createOwnerRecord(type, initial = {}) {
      ownerRecordSerial += 1;
      const record = {
        id: `owner_${ownerRecordSerial}`,
        type,
        aliases: new Set(),
        displayName: initial.displayName || null,
        person:
          type === "person"
            ? {
                birth_date: initial.person?.birth_date ?? null,
                first_name: initial.person?.first_name ?? null,
                last_name: initial.person?.last_name ?? null,
                middle_name: initial.person?.middle_name ?? null,
                prefix_name: initial.person?.prefix_name ?? null,
                suffix_name: initial.person?.suffix_name ?? null,
                us_citizenship_status: initial.person?.us_citizenship_status ?? null,
                veteran_status: initial.person?.veteran_status ?? null,
                request_identifier: initial.person?.request_identifier ?? null,
              }
            : undefined,
        company:
          type === "company"
            ? {
                name: initial.company?.name ?? null,
                request_identifier: initial.company?.request_identifier ?? null,
              }
            : undefined,
      };
      ownerRecords.set(record.id, record);
      return record;
    }

    function ensureOwnerRecordFromOwnerData(ownerEntry) {
      if (!ownerEntry || typeof ownerEntry !== "object") return null;
      const ownerType = ownerEntry.type === "company" ? "company" : "person";
      if (ownerType === "person") {
        const personData = {
          birth_date: ownerEntry.birth_date ?? null,
          first_name: ownerEntry.first_name ?? null,
          last_name: ownerEntry.last_name ?? null,
          middle_name: ownerEntry.middle_name ?? null,
          prefix_name: ownerEntry.prefix_name ?? null,
          suffix_name: ownerEntry.suffix_name ?? null,
          us_citizenship_status: ownerEntry.us_citizenship_status ?? null,
          veteran_status: ownerEntry.veteran_status ?? null,
          request_identifier: ownerEntry.request_identifier ?? null,
        };
        const candidateDisplay =
          ownerEntry.full_name ||
          buildPersonDisplayName(personData) ||
          ownerEntry.name ||
          ownerEntry.raw_name ||
          null;
        let record = candidateDisplay
          ? getOwnerRecordByAlias(candidateDisplay)
          : null;
        if (!record) {
          record = createOwnerRecord("person", {
            person: personData,
            displayName: candidateDisplay,
          });
        } else if (record.person) {
          for (const [k, v] of Object.entries(personData)) {
            if (record.person[k] == null && v != null) {
              record.person[k] = v;
            }
          }
          if (!record.displayName && candidateDisplay) {
            record.displayName = candidateDisplay;
          }
        }
        if (candidateDisplay) registerAlias(record, candidateDisplay);
        if (ownerEntry.raw_name) registerAlias(record, ownerEntry.raw_name);
        if (!record.displayName) {
          record.displayName =
            buildPersonDisplayName(record.person) || record.displayName;
        }
        return record;
      }

      const companyData = {
        name:
          ownerEntry.name ??
          ownerEntry.company_name ??
          ownerEntry.full_name ??
          ownerEntry.raw_name ??
          null,
        request_identifier: ownerEntry.request_identifier ?? null,
      };
      const candidateDisplay = companyData.name || ownerEntry.raw_name || null;
      let record = candidateDisplay
        ? getOwnerRecordByAlias(candidateDisplay)
        : null;
      if (!record) {
        record = createOwnerRecord("company", {
          company: companyData,
          displayName: candidateDisplay,
        });
      } else if (record.company) {
        if (!record.company.name && companyData.name) {
          record.company.name = companyData.name;
        }
        if (
          record.company.request_identifier == null &&
          companyData.request_identifier != null
        ) {
          record.company.request_identifier = companyData.request_identifier;
        }
        if (!record.displayName && candidateDisplay) {
          record.displayName = candidateDisplay;
        }
      }
      if (companyData.name) registerAlias(record, companyData.name);
      if (ownerEntry.raw_name) registerAlias(record, ownerEntry.raw_name);
      if (!record.displayName && companyData.name) {
        record.displayName = companyData.name;
      }
      return record;
    }

    function ensureOwnerRecordFromName(name) {
      const cleaned = textClean(name);
      if (!cleaned) return null;
      const existing = getOwnerRecordByAlias(cleaned);
      if (existing) {
        registerAlias(existing, cleaned);
        return existing;
      }
      const ownerType = guessOwnerType(cleaned);
      if (ownerType === "company") {
        const record = createOwnerRecord("company", {
          company: { name: cleaned },
          displayName: cleaned,
        });
        registerAlias(record, cleaned);
        return record;
      }
      const parsed = parsePersonNameTokens(cleaned);
      const personData = {
        first_name: parsed?.first_name ?? null,
        last_name: parsed?.last_name ?? null,
        middle_name: parsed?.middle_name ?? null,
        // Other fields are null by default in createOwnerRecord
      };
      const record = createOwnerRecord("person", {
        person: personData,
        displayName: cleaned,
      });
      registerAlias(record, cleaned);
      return record;
    }

    function registerPropertyRole(record, roleLabel) {
      if (!record) return;
      const key = record.id;
      const set = ownerPropertyRoles.get(key) || new Set();
      if (roleLabel && typeof roleLabel === "string") set.add(roleLabel);
      else set.add("current");
      ownerPropertyRoles.set(key, set);
    }

    const possibleOwnerKeys = [];
    if (propertyOut && propertyOut.parcel_identifier) {
      possibleOwnerKeys.push(`property_${propertyOut.parcel_identifier}`);
    }
    if (parcelIdentifierDashed) {
      possibleOwnerKeys.push(`property_${parcelIdentifierDashed}`);
    }
    const ownerKey =
      possibleOwnerKeys.find(
        (key) =>
          ownerData && Object.prototype.hasOwnProperty.call(ownerData, key),
      ) || null;
    const ownerPropertyData = ownerKey ? ownerData[ownerKey] : null;

    let currentOwnerRecord = null;
    let currentOwnerName = null;
    let mailingAddressText = null; // Variable to store mailing address text
    let mailingAddressOut = null; // Declare mailingAddressOut here

    let currentOwnerAliasKeys = new Set();
    let currentOwnerDisplayNames = [];
    let currentOwnerDisplayNamesUpper = [];

    if (ownerPropertyData && ownerPropertyData.owners_by_date) {
      const allOwnerEntries = [];
      for (const [roleKey, ownersList] of Object.entries(ownerPropertyData.owners_by_date)) {
        if (Array.isArray(ownersList)) {
          for (const ownerEntry of ownersList) {
            allOwnerEntries.push({ ownerEntry, roleKey });
          }
        }
      }

      allOwnerEntries.sort((a, b) => {
        if (a.roleKey.toLowerCase() === 'current' && b.roleKey.toLowerCase() !== 'current') return -1;
        if (a.roleKey.toLowerCase() !== 'current' && b.roleKey.toLowerCase() === 'current') return 1;
        return 0;
      });

      for (const { ownerEntry, roleKey } of allOwnerEntries) {
        const record = ensureOwnerRecordFromOwnerData(ownerEntry);
        if (!record) continue;
        registerPropertyRole(record, roleKey);
        if (roleKey.toLowerCase() === "current" && !currentOwnerRecord) {
          currentOwnerRecord = record;
        }
        if (roleKey.toLowerCase() === "current" && record) {
          if (!currentOwnerRecordIds.has(record.id)) {
            currentOwnerRecordIds.add(record.id);
            currentOwnerRecordsList.push(record);
          }
        }
      }

      for (const record of currentOwnerRecordsList) {
        if (record.aliases && record.aliases.size) {
          for (const aliasKey of record.aliases) {
            currentOwnerAliasKeys.add(aliasKey);
          }
        }
        if (record.displayName) {
          currentOwnerDisplayNames.push(record.displayName);
        }
        if (record.person) {
          const display = buildPersonDisplayName(record.person);
          if (display) currentOwnerDisplayNames.push(display);
        }
        if (record.company?.name) {
          currentOwnerDisplayNames.push(record.company.name);
        }
      }

      currentOwnerDisplayNamesUpper = currentOwnerDisplayNames
        .filter((name) => typeof name === "string" && name.trim())
        .map((name) => name.toUpperCase());
    }

    // Extract owner name and mailing address from HTML
    const ownerP = $("article#ownership .bottom-text p").first();
    if (ownerP && ownerP.length) {
      console.log("--- Mailing Address Debugging ---");
      console.log("Raw HTML of Ownership P tag:", ownerP.html());

      // Replace all <br> tags (with or without attributes) with a newline character
      const htmlContent = ownerP.html();
      const cleanedHtml = htmlContent.replace(/<br[^>]*>/gi, '\n'); 
      
      // Split by newline characters, then clean each line and filter out any empty ones
      const lines = cleanedHtml.split('\n').map(line => textClean(line)).filter(Boolean);

      console.log("Lines after replacing <br> with \\n and cleaning:", lines);

      if (lines.length > 0) {
        const normalizedLines = lines.map((line, index) => ({
          line,
          index,
          key: normalizeOwnerKey(line),
        }));

        const ownerLineIndices = new Set();
        for (const item of normalizedLines) {
          const { index, key, line } = item;
          if (key && currentOwnerAliasKeys.has(key)) {
            ownerLineIndices.add(index);
            continue;
          }
          const upperLine = line.toUpperCase();
          if (currentOwnerDisplayNamesUpper.includes(upperLine)) {
            ownerLineIndices.add(index);
          }
        }

        if (ownerLineIndices.size === 0) {
          ownerLineIndices.add(0);
        }

        const sortedOwnerIndices = Array.from(ownerLineIndices).sort(
          (a, b) => a - b,
        );
        if (!currentOwnerName && sortedOwnerIndices.length) {
          currentOwnerName = normalizedLines[sortedOwnerIndices[0]].line;
        } else if (!currentOwnerName && normalizedLines.length) {
          currentOwnerName = normalizedLines[0].line;
        }

        const mailingAddressLines = normalizedLines
          .filter(({ index }) => !ownerLineIndices.has(index))
          .map(({ line }) => line)
          .filter(Boolean);

        mailingAddressText =
          mailingAddressLines.length > 0
            ? mailingAddressLines.join(" ").trim()
            : null;
      }
      console.log("Extracted currentOwnerName:", currentOwnerName);
      console.log("Extracted mailingAddressText (raw):", mailingAddressText);
    }

    // If current owner not found from owner_data.json, create from HTML
    if (!currentOwnerRecord && currentOwnerName) {
      currentOwnerRecord = ensureOwnerRecordFromName(currentOwnerName);
      registerPropertyRole(currentOwnerRecord, "current");
    } else if (currentOwnerRecord && !currentOwnerName) {
      currentOwnerName = currentOwnerRecord.displayName || null;
    }

    // --- Mailing Address File Creation ---
    if (mailingAddressText) {
      // No need to break down, just store the full text in unnormalized_address
      mailingAddressOut = {
        source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
        request_identifier: baseRequestData.request_identifier || null,
        unnormalized_address: mailingAddressText, // Store the full cleaned text here
        // All other structured fields are null as per instruction
        latitude:  null,
        longitude: null
        // country_code: null,
        // city_name: null,
        // postal_code: null,
        // plus_four_postal_code: null,
        // state_code: null,
        // street_number: null,
        // street_name: null,
        // street_post_directional_text: null,
        // street_pre_directional_text: null,
        // street_suffix_type: null,
        // unit_identifier: null,
        // route_number: null,
        // po_box_number: null,
      };

      console.log("Final Mailing Address Object (unnormalized):", mailingAddressOut);

      await fsp.writeFile(
        path.join("data", "mailing_address.json"),
        JSON.stringify(mailingAddressOut, null, 2),
      );
      console.log("mailing_address.json created.");
    }


    const salesRows = $("article#sale-info table.table tbody tr").toArray();
    for (let i = salesRows.length - 1; i >= 0; i--) { // Iterate in reverse to get chronological order
      const tr = salesRows[i];
      const tds = $(tr).find("th, td");
      if (!tds || tds.length < 6) continue;

      const dateTxt = textClean($(tds[0]).text());
      const bookPageText = textClean($(tds[1]).text());
      const bookPageLink = $(tds[1]).find("a").attr("href");
      const deedCode = textClean($(tds[3]).text());
      const grantorName = textClean($(tds[4]).text());
      const priceTxt = textClean($(tds[5]).text());

      const iso = parseDateToISO(dateTxt);
      if (!iso) continue;
      const priceNum = parseCurrencyToNumber(priceTxt);
      const deedReference = extractDeedReference(bookPageText, bookPageLink);

      const sale = {
        ownership_transfer_date: iso,
        purchase_price_amount: priceNum && priceNum > 0 ? priceNum : 0,
        _deed_code: deedCode || null,
        _book_page: bookPageText || null,
        _book_page_url: bookPageLink || null,
        _deed_reference: deedReference,
        _deed_book: deedReference.book,
        _deed_page: deedReference.page,
        _deed_volume: deedReference.volume,
        _deed_instrument_number: deedReference.instrument_number,
        _grantor_name: grantorName || null,
        _grantee_name: null, // Will be set below
        _grantor_record_id: null, // Will be set below
        _grantee_record_id: null, // Will be set below
      };
      sales.push(sale); // Push to maintain chronological order
    }

    // Now, assign grantees based on the chronological order of sales
    let previousGranteeRecord = currentOwnerRecord; // The grantee of the *first* sale is the current owner
    let previousGranteeName = currentOwnerName;

    for (let i = sales.length - 1; i >= 0; i--) { // Iterate sales in reverse chronological order for assignment
      const sale = sales[i];

      // The grantee of the current sale is the previousGranteeRecord
      sale._grantee_record_id = previousGranteeRecord ? previousGranteeRecord.id : null;
      sale._grantee_name = previousGranteeName;

      // Ensure grantor record exists or create it
      let grantorRecord = sale._grantor_name ? ensureOwnerRecordFromName(sale._grantor_name) : null;
      sale._grantor_record_id = grantorRecord ? grantorRecord.id : null;

      // For the next iteration (previous sale chronologically), this sale's grantor becomes the grantee
      previousGranteeRecord = grantorRecord;
      previousGranteeName = sale._grantor_name;
    }


    await removeExisting(/^person_.*\.json$/);
    await removeExisting(/^company_.*\.json$/);
    await removeExisting(/^relationship_property_has_company_.*\.json$/);
    await removeExisting(/^relationship_sales_history_.*_has_person_.*\.json$/); 
    await removeExisting(/^relationship_sales_history_.*_has_company_.*\.json$/); 
    await removeExisting(/^relationship_person_.*_has_mailing_address\.json$/); 

    const ownerToFileMap = new Map();
    let personIdx = 0;
    let companyIdx = 0;

    for (const record of ownerRecords.values()) {
      if (record.type === "person") {
        personIdx += 1;
        const personOut = {
          source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
          birth_date: record.person?.birth_date ?? null,
          first_name: record.person?.first_name ?? null,
          last_name: record.person?.last_name ?? null,
          middle_name: record.person?.middle_name ?? null,
          prefix_name: record.person?.prefix_name ?? null,
          suffix_name: record.person?.suffix_name ?? null,
          us_citizenship_status: record.person?.us_citizenship_status ?? null,
          veteran_status: record.person?.veteran_status ?? null,
          request_identifier: record.person?.request_identifier ?? null,
        };
        const fileName = `person_${personIdx}.json`;
        await fsp.writeFile(
          path.join("data", fileName),
          JSON.stringify(personOut, null, 2),
        );
        ownerToFileMap.set(record.id, {
          fileName,
          type: "person",
          index: personIdx,
        });
      } else {
        companyIdx += 1;
        const companyOut = {
          source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
          name: record.company?.name ?? record.displayName ?? null,
          request_identifier: record.company?.request_identifier ?? null,
        };
        const fileName = `company_${companyIdx}.json`;
        await fsp.writeFile(
          path.join("data", fileName),
          JSON.stringify(companyOut, null, 2),
        );
        ownerToFileMap.set(record.id, {
          fileName,
          type: "company",
          index: companyIdx,
        });
      }
    }

    // --- Create relationship between latest owner (if person) and mailing address ---
    // This relationship should only be created if mailingAddressOut was successfully created
    // and ownerToFileMap is now fully populated.
    if (currentOwnerRecord  && mailingAddressOut) {
      const latestOwnerMeta = ownerToFileMap.get(currentOwnerRecord.id);
      if (latestOwnerMeta) { // Ensure it's a person for this relationship
        const relFileName = `relationship_${latestOwnerMeta.type}_${latestOwnerMeta.index}_has_mailing_address.json`;
        const relOut = {
          from: { "/": `./${latestOwnerMeta.fileName}` },
          to: { "/": "./mailing_address.json" },
        };
        await fsp.writeFile(
          path.join("data", relFileName),
          JSON.stringify(relOut, null, 2),
        );
        console.log(`Created mailing address relationship: ${relFileName}`);
      } else {
        console.log("Warning: Could not find metadata for currentOwnerRecord (or it's not a person) to create mailing address relationship.");
      }
    } else {
      console.log("Mailing address relationship not created. Conditions not met:", {
        currentOwnerRecord: !!currentOwnerRecord,
        isPerson: currentOwnerRecord?.type === "person",
        mailingAddressOut: !!mailingAddressOut
      });
    }


    const propertyRelCounters = { person: 0, company: 0 };
    for (const [recordId, roles] of ownerPropertyRoles.entries()) {
      const meta = ownerToFileMap.get(recordId);
      if (!meta || !roles || roles.size === 0) continue;
      // Only create property_has_company relationships, not property_has_person
      if (meta.type === "company") {
        for (const role of roles) {
          propertyRelCounters[meta.type] += 1;
          const relFileName = `relationship_property_has_${meta.type}_${propertyRelCounters[meta.type]}_${slugify(role)}.json`;
          const relOut = {
            from: { "/": "./property.json" },
            to: { "/": `./${meta.fileName}` },
            // type: "property_has_company", // Removed 'type' property
          };
          await fsp.writeFile(
            path.join("data", relFileName),
            JSON.stringify(relOut, null, 2),
          );
        }
      }
    }

    await removeExisting(/^sales_.*\.json$/);
    await removeExisting(/^deed_.*\.json$/);
    await removeExisting(/^file_.*\.json$/);
    await removeExisting(/^relationship_sales_history_.*_to_deed_.*\.json$/);
    await removeExisting(/^relationship_deed_.*_to_file_.*\.json$/);
    // await removeExisting(/^relationship_property_has_sales_history_.*\.json$/); // Removed this line

    const ALLOWED_DEED_TYPES = [
      "Warranty Deed",
      "Special Warranty Deed",
      "Quitclaim Deed",
      "Grant Deed",
      "Bargain and Sale Deed",
      "Lady Bird Deed",
      "Transfer on Death Deed",
      "Sheriff's Deed",
      "Tax Deed",
      "Trustee's Deed",
      "Personal Representative Deed",
      "Correction Deed",
      "Deed in Lieu of Foreclosure",
      "Life Estate Deed",
      "Joint Tenancy Deed",
      "Tenancy in Common Deed",
      "Community Property Deed",
      "Gift Deed",
      "Interspousal Transfer Deed",
      "Wild Deed",
      "Special Master's Deed",
      "Court Order Deed",
      "Contract for Deed",
      "Quiet Title Deed",
      "Administrator's Deed",
      "Guardian's Deed",
      "Receiver's Deed",
      "Right of Way Deed",
      "Vacation of Plat Deed",
      "Assignment of Contract",
      "Release of Contract",
      "Miscellaneous",
    ];

    const ALLOWED_DOCUMENT_TYPES = [
      "Title",
      "ConveyanceDeed",
      "ConveyanceDeedWarrantyDeed",
      "ConveyanceDeedQuitClaimDeed",
      "ConveyanceDeedBargainAndSaleDeed",
    ];

    function validateEnum(value, allowedValues, entityName, propertyName) {
      if (value == null) return null;
      if (allowedValues.includes(value)) return value;
      console.warn(`Unsupported ${entityName}.${propertyName} value: ${value}`);
      return null;
    }

    const DEED_CODE_TO_TYPE = {
      AA: "Contract for Deed",
      AC: "Assignment of Contract",
      AF: "Miscellaneous",
      CD: "Correction Deed",
      CJ: "Personal Representative Deed",
      CP: "Community Property Deed",
      CT: "Quiet Title Deed",
      CV: "Miscellaneous",
      DE: "Warranty Deed",
      FJ: "Court Order Deed",
      GD: "Grant Deed",
      GP: "Gift Deed",
      IL: "Deed in Lieu of Foreclosure",
      IT: "Interspousal Transfer Deed",
      JT: "Joint Tenancy Deed",
      LE: "Life Estate Deed",
      MS: "Assignment of Contract",
      OA: "Administrator's Deed",
      OJ: "Court Order Deed",
      OT: "Transfer on Death Deed",
      PB: "Administrator's Deed",
      PR: "Personal Representative Deed",
      PRDEED: "Personal Representative Deed",
      QC: "Quitclaim Deed",
      RC: "Release of Contract",
      RW: "Right of Way Deed",
      SC: "Bargain and Sale Deed",
      SD: "Sheriff's Deed",
      SH: "Sheriff's Deed",
      SP: "Special Warranty Deed",
      SW: "Special Warranty Deed",
      TD: "Tax Deed",
      TR: "Trustee's Deed",
      TRUST: "Trustee's Deed",
      WD: "Warranty Deed",
      WI: "Gift Deed",
    };

    function mapDeedCodeToType(code) {
      const normalized = (code || "").toUpperCase();
      if (!normalized) return null;
      const mapped =
        DEED_CODE_TO_TYPE[normalized] ||
        (ALLOWED_DEED_TYPES.includes(textClean(code))
          ? textClean(code)
          : null);
      return validateEnum(mapped, ALLOWED_DEED_TYPES, "Deed", "deed_type");
    }

    const DOCUMENT_TYPE_BY_DEED = {
      "Warranty Deed": "ConveyanceDeedWarrantyDeed",
      "Quitclaim Deed": "ConveyanceDeedQuitClaimDeed",
      "Bargain and Sale Deed": "ConveyanceDeedBargainAndSaleDeed",
    };

    const GENERIC_CONVEYANCE_DOCUMENT_TYPE = validateEnum(
      "ConveyanceDeed",
      ALLOWED_DOCUMENT_TYPES,
      "File",
      "document_type",
    );

    const GENERIC_TITLE_DOCUMENT_TYPE = validateEnum(
      "Title",
      ALLOWED_DOCUMENT_TYPES,
      "File",
      "document_type",
    );

    function mapDocumentTypeFromDeed(deedType) {
      if (!deedType) return GENERIC_CONVEYANCE_DOCUMENT_TYPE;
      const mapped = DOCUMENT_TYPE_BY_DEED[deedType] || null;
      if (mapped) {
        const validated = validateEnum(
          mapped,
          ALLOWED_DOCUMENT_TYPES,
          "File",
          "document_type",
        );
        if (validated) return validated;
      }
      return GENERIC_CONVEYANCE_DOCUMENT_TYPE;
    }

    function mapSupplementalDocumentType(url, format) {
      const targetUrl = url || "";
      const normalizedFormat = (format || "").toLowerCase();
      if (/TrimPrint/i.test(targetUrl)) return GENERIC_TITLE_DOCUMENT_TYPE;
      if (/mapbook/i.test(targetUrl)) return GENERIC_TITLE_DOCUMENT_TYPE;
      if (/ImageSketches/i.test(targetUrl)) return GENERIC_TITLE_DOCUMENT_TYPE;
      if (normalizedFormat === "jpeg" || normalizedFormat === "png") {
        return GENERIC_TITLE_DOCUMENT_TYPE;
      }
      return GENERIC_TITLE_DOCUMENT_TYPE;
    }

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];
      const saleFileName = `sales_history_${i + 1}.json`;
      const saleOut = {
        source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
        request_identifier: baseRequestData.request_identifier || null,
        ownership_transfer_date: sale.ownership_transfer_date,
        purchase_price_amount: sale.purchase_price_amount,
      };
      await fsp.writeFile(
        path.join("data", saleFileName),
        JSON.stringify(saleOut, null, 2),
      );

      const deedType = mapDeedCodeToType(sale._deed_code);

      // Only create deed.json and related files/relationships if deedType is not null
      if (deedType !== null) {
        const deedFileName = `deed_${i + 1}.json`;
        const deedOut = {
          source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
          deed_type: deedType,
        };
        await fsp.writeFile(
          path.join("data", deedFileName),
          JSON.stringify(deedOut, null, 2),
        );

        const relSalesDeed = {
          from: { "/": `./${saleFileName}` },
          to: { "/": `./${deedFileName}` },
        };
        await fsp.writeFile(
          path.join(
            "data",
            `relationship_sales_history_${i + 1}_to_deed_${i + 1}.json`,
          ),
          JSON.stringify(relSalesDeed, null, 2),
        );

        // --- Create sales_history_has_person/company relationships ---
        // if (sale._grantor_record_id) {
        //   const grantorMeta = ownerToFileMap.get(sale._grantor_record_id);
        //   if (grantorMeta) {
        //     const relFileName = `relationship_sales_history_${i + 1}_has_${grantorMeta.type}_${grantorMeta.index}.json`; // Removed _grantor from filename
        //     const relOut = {
        //       from: { "/": `./${saleFileName}` },
        //       to: { "/": `./${grantorMeta.fileName}` },
        //       // type: `sales_history_has_${grantorMeta.type}`, // Removed 'type' property
        //     };
        //     await fsp.writeFile(
        //       path.join("data", relFileName),
        //       JSON.stringify(relOut, null, 2),
        //     );
        //   }
        // }

        if (sale._grantee_record_id) {
          const granteeMeta = ownerToFileMap.get(sale._grantee_record_id);
          if (granteeMeta) {
            const relFileName = `relationship_sales_history_${i + 1}_has_${granteeMeta.type}_${granteeMeta.index}.json`;
            const relOut = {
              from: { "/": `./${saleFileName}` },
              to: { "/": `./${granteeMeta.fileName}` },
              // type: `sales_history_has_${granteeMeta.type}`, // Removed 'type' property
            };
            await fsp.writeFile(
              path.join("data", relFileName),
              JSON.stringify(relOut, null, 2),
            );
          }
        }
        // --- End of sales_history_has_person/company relationships ---


        if (sale._book_page_url) {
          fileIdx += 1;
          const fileFileName = `file_${fileIdx}.json`;
          const fileOut = {
            source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
            request_identifier: baseRequestData.request_identifier || null,
            file_format: getFileFormatFromUrl(sale._book_page_url),
            name: path.basename(sale._book_page_url) || null,
            original_url: sale._book_page_url,
            ipfs_url: null,
            document_type: "ConveyanceDeed",
          };
          await fsp.writeFile(
            path.join("data", fileFileName),
            JSON.stringify(fileOut, null, 2),
          );

          const relDeedFile = {
            from: { "/": `./${deedFileName}` },
            to: { "/": `./${fileFileName}` },
          };
          await fsp.writeFile(
            path.join("data", `relationship_deed_${i + 1}_to_file_${fileIdx}.json`),
            JSON.stringify(relDeedFile, null, 2),
          );
        }
      } // End of if (deedType !== null)
    }
  }


  // Removed propertyKeyCandidates and resolvedUtilityKey/resolvedLayoutKey
  // as they are no longer needed for direct processing of structure_data.json

  const utilityIndexToFile = new Map();
  const structureIndexToFile = new Map();
  const layoutIndexToFile = new Map();

  // Tax extraction: clear old and create one file per year option present
  await removeExisting(/^tax_.*\.json$/);
  if (!isMulti) {
    const targetTaxYear = 2025; // Only include tax for 2025

    let buildingVal = null,
      landVal = null,
      justVal = null,
      assessedVal = null,
      taxableVal = null;
    $("article#property-values table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      const amt = parseCurrencyToNumber(td);
      if (/^Building$/i.test(th)) buildingVal = amt;
      if (/^SFYI$/i.test(th)) { /* SFYI is not directly mapped to building or land, ignore for now */ }
      if (/^Land$/i.test(th)) landVal = amt;
      if (/^Just\/Market$/i.test(th)) justVal = amt;
      if (/^Assessed$/i.test(th)) assessedVal = amt;
      if (/^Taxable$/i.test(th)) taxableVal = amt;
    });

    // Check if the targetTaxYear is present in the dropdown (optional, but good for robustness)
    let foundTargetYear = false;
    $("article#property-values select option").each((i, opt) => {
      const yr = parseInt(textClean($(opt).text()), 10);
      if (yr === targetTaxYear) {
        foundTargetYear = true;
        return false; // Break .each loop
      }
    });

    if (foundTargetYear) { // Only write tax data if 2025 is found
      const taxFileName = `tax_${targetTaxYear}.json`;
      const taxOut = {
        source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
        request_identifier: baseRequestData.request_identifier || null,
        tax_year: targetTaxYear,
        property_assessed_value_amount:
          assessedVal && assessedVal > 0 ? assessedVal : null,
        property_market_value_amount: justVal && justVal > 0 ? justVal : null,
        property_building_amount:
          buildingVal && buildingVal > 0 ? buildingVal : null,
        property_land_amount: landVal && landVal > 0 ? landVal : null,
        property_taxable_value_amount:
          taxableVal && taxableVal > 0 ? taxableVal : null,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
        yearly_tax_amount: null,
      };
      await fsp.writeFile(
        path.join("data", taxFileName),
        JSON.stringify(taxOut, null, 2),
      );
    }
  }

  // Utilities from owners/utilities_data.json (use best available key)
  await removeExisting(/^utility_.*\.json$/);
  await removeExisting(/^utility\.json$/);
  await removeExisting(/^relationship_property_has_utility_.*\.json$/); // Remove this relationship

  const utilityEntries = [];
  const utilityRecords = [];
  let utilitiesTotalBuildings = null;
  if (utilitiesData && typeof utilitiesData === "object") {
    for (const key of Object.keys(utilitiesData)) {
      if (!Object.prototype.hasOwnProperty.call(utilitiesData, key)) continue;
      const entry = utilitiesData[key];
      if (!entry) continue;

      if (Array.isArray(entry.building_utilities)) {
        for (const util of entry.building_utilities) {
          if (util && typeof util === "object") utilityEntries.push({ ...util });
        }
      } else if (entry.building_utilities && typeof entry.building_utilities === "object") {
        utilityEntries.push({ ...entry.building_utilities });
      } else if (Array.isArray(entry)) {
        for (const util of entry) {
          if (util && typeof util === "object") utilityEntries.push({ ...util });
        }
      } else if (
        entry &&
        typeof entry === "object" &&
        (
          "cooling_system_type" in entry ||
          "heating_system_type" in entry ||
          "public_utility_type" in entry ||
          "water_source_type" in entry ||
          "sewer_type" in entry
        )
      ) {
        utilityEntries.push({ ...entry });
      }

      if (
        utilitiesTotalBuildings == null &&
        entry &&
        typeof entry === "object" &&
        entry.total_buildings != null
      ) {
        const tb = Number(entry.total_buildings);
        if (!Number.isNaN(tb)) utilitiesTotalBuildings = tb;
      }
    }
  }

  for (let i = 0; i < utilityEntries.length; i++) {
    const util = utilityEntries[i] || {};
    const fileName = `utility_${i + 1}.json`;

    const utilityOut = { ...util };
    const utilityBuildingNumber =
      Object.prototype.hasOwnProperty.call(utilityOut, "building_number")
        ? utilityOut.building_number
        : null;
    if (Object.prototype.hasOwnProperty.call(utilityOut, "building_number")) {
      delete utilityOut.building_number;
    }
    if (Object.prototype.hasOwnProperty.call(utilityOut, "number_of_buildings")) {
      delete utilityOut.number_of_buildings;
    }

    if (utilityOut.url && utilityOut.url.includes("placeholder")) {
      utilityOut.url = sourceHttpRequestUrl;
    }
    utilityOut.source_http_request = sourceHttpRequest;
    utilityOut.request_identifier = baseRequestData.request_identifier || null;

    await fsp.writeFile(
      path.join("data", fileName),
      JSON.stringify(utilityOut, null, 2),
    );
    utilityIndexToFile.set(i + 1, fileName);
    utilityRecords.push({
      index: i + 1,
      file: fileName,
      building_number: utilityBuildingNumber,
    });
  }

  // Structure extraction (prefer owners/structure_data.json)
  await removeExisting(/^structure_.*\.json$/);
  await removeExisting(/^structure\.json$/); // Ensure this is removed if it exists
  await removeExisting(/^relationship_property_has_structure_.*\.json$/); // Remove this relationship

  const structureEntries = [];
  const structureRecords = [];
  let structuresTotalBuildings = null;
  if (structureData && typeof structureData === "object") {
    for (const key of Object.keys(structureData)) {
      if (!Object.prototype.hasOwnProperty.call(structureData, key)) continue;
      const entry = structureData[key];
      if (!entry) continue;

      if (Array.isArray(entry.building_structures)) {
        for (const structure of entry.building_structures) {
          if (structure && typeof structure === "object") {
            structureEntries.push({ ...structure });
          }
        }
      } else if (entry.building_structures && typeof entry.building_structures === "object") {
        structureEntries.push({ ...entry.building_structures });
      } else if (Array.isArray(entry)) {
        for (const structure of entry) {
          if (structure && typeof structure === "object") structureEntries.push({ ...structure });
        }
      } else if (
        entry &&
        typeof entry === "object" &&
        (
          "roof_covering_material" in entry ||
          "exterior_wall_material_primary" in entry ||
          "flooring_material_primary" in entry ||
          "number_of_buildings" in entry
        )
      ) {
        structureEntries.push({ ...entry });
      }

      if (
        structuresTotalBuildings == null &&
        entry &&
        typeof entry === "object" &&
        entry.total_buildings != null
      ) {
        const tb = Number(entry.total_buildings);
        if (!Number.isNaN(tb)) structuresTotalBuildings = tb;
      }
    }
  }

  for (let i = 0; i < structureEntries.length; i++) {
    const structure = structureEntries[i] || {};
    const fileName = `structure_${i + 1}.json`;

    const structureOut = { ...structure };
    const structureBuildingNumber =
      Object.prototype.hasOwnProperty.call(structureOut, "building_number")
        ? structureOut.building_number
        : null;
    if (Object.prototype.hasOwnProperty.call(structureOut, "building_number")) {
      delete structureOut.building_number;
    }
    if (Object.prototype.hasOwnProperty.call(structureOut, "number_of_buildings")) {
      delete structureOut.number_of_buildings;
    }

    if (structureOut.url && structureOut.url.includes("placeholder")) {
      structureOut.url = sourceHttpRequestUrl;
    }
    structureOut.source_http_request = sourceHttpRequest;
    structureOut.request_identifier = baseRequestData.request_identifier || null;

    await fsp.writeFile(
      path.join("data", fileName),
      JSON.stringify(structureOut, null, 2),
    );
    structureIndexToFile.set(i + 1, fileName);
    structureRecords.push({
      index: i + 1,
      file: fileName,
      building_number: structureBuildingNumber,
    });
  }

  // Layouts from owners/layout_data.json
  await removeExisting(/^layout_.*\.json$/);
  await removeExisting(/^relationship_property_has_layout_.*\.json$/);
  await removeExisting(/^relationship_layout_.*_has_layout_.*\.json$/);
  await removeExisting(/^relationship_layout_.*_has_structure_.*\.json$/);
  await removeExisting(/^relationship_layout_.*_has_utility_.*\.json$/);
  await removeExisting(/^relationship_layout_.*\.json$/);

  const layoutEntries = [];
  if (layoutData && typeof layoutData === "object") {
    for (const key of Object.keys(layoutData)) {
      if (!Object.prototype.hasOwnProperty.call(layoutData, key)) continue;
      const entry = layoutData[key];
      if (!entry) continue;
      if (Array.isArray(entry.layouts)) {
        layoutEntries.push(...entry.layouts.filter((e) => e && typeof e === "object"));
      } else if (Array.isArray(entry)) {
        layoutEntries.push(...entry.filter((e) => e && typeof e === "object"));
      } else if (entry && typeof entry === "object" && !entry.layouts) {
        layoutEntries.push(entry);
      }
    }
  }

  const layoutRecords = [];
  const buildingLayoutIndexByNumber = new Map();
  const buildingLayoutIndices = [];

  for (let i = 0; i < layoutEntries.length; i++) {
    const layout = layoutEntries[i] || {};
    const fileName = `layout_${i + 1}.json`;

    const layoutOut = { ...layout };
    if (layoutOut.url && layoutOut.url.includes("placeholder")) {
      layoutOut.url = sourceHttpRequestUrl;
    }
    layoutOut.source_http_request = sourceHttpRequest;
    layoutOut.request_identifier = baseRequestData.request_identifier || null;

    if (layoutOut.space_type === "Building") {
      if (layoutOut.building_number == null) {
        layoutOut.building_number = buildingLayoutIndices.length + 1;
      }
      if (!buildingLayoutIndexByNumber.has(layoutOut.building_number)) {
        buildingLayoutIndexByNumber.set(layoutOut.building_number, i + 1);
      }
      buildingLayoutIndices.push(i + 1);
    } else if (layoutOut.building_number === undefined) {
      layoutOut.building_number = null;
    }

    await fsp.writeFile(
      path.join("data", fileName),
      JSON.stringify(layoutOut, null, 2),
    );
    layoutIndexToFile.set(i + 1, fileName);
    layoutRecords.push({
      index: i + 1,
      file: fileName,
      space_type: layoutOut.space_type || null,
      building_number: layoutOut.building_number ?? null,
    });
  }

  const derivedTotalBuildings =
    buildingLayoutIndices.length > 0
      ? buildingLayoutIndices.length
      : Math.max(
          utilitiesTotalBuildings || 0,
          structuresTotalBuildings || 0,
        );
  const hasSingleBuildingLayout = buildingLayoutIndices.length === 1;
  const multiBuilding =
    buildingLayoutIndices.length > 1 ||
    (buildingLayoutIndices.length === 0 && derivedTotalBuildings > 1);
  const primaryBuildingIndex = hasSingleBuildingLayout
    ? buildingLayoutIndices[0]
    : null;

  // if (propertyOut) {
  //   for (const record of layoutRecords) {
  //     if (multiBuilding || record.space_type === "Building") {
  //       const relFile = `relationship_property_has_layout_${record.index}.json`;
  //       const relOut = {
  //         from: { "/": "./property.json" },
  //         to: { "/": `./${record.file}` },
  //       };
  //       await fsp.writeFile(
  //         path.join("data", relFile),
  //         JSON.stringify(relOut, null, 2),
  //       );
  //     }
  //   }
  // }

  for (const record of layoutRecords) {
    if (record.space_type === "Building") continue;
    let parentIndex = null;
    if (
      record.building_number != null &&
      buildingLayoutIndexByNumber.has(record.building_number)
    ) {
      parentIndex = buildingLayoutIndexByNumber.get(record.building_number);
    } else if (!multiBuilding && primaryBuildingIndex != null) {
      parentIndex = primaryBuildingIndex;
    }
    if (
      parentIndex != null &&
      parentIndex !== record.index &&
      layoutIndexToFile.has(parentIndex)
    ) {
      const relFile = `relationship_layout_${parentIndex}_has_layout_${record.index}.json`;
      const relOut = {
        from: { "/": `./${layoutIndexToFile.get(parentIndex)}` },
        to: { "/": `./${record.file}` },
      };
      await fsp.writeFile(
        path.join("data", relFile),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  const propertyRef = { "/": "./property.json" };

  // if (propertyOut) {
  //   for (const record of propertyImprovementRecords) {
  //     const relFile = `relationship_property_has_property_improvement_${record.index}.json`;
  //     const relOut = {
  //       from: propertyRef,
  //       to: { "/": `./${record.file}` },
  //     };
  //     await fsp.writeFile(
  //       path.join("data", relFile),
  //       JSON.stringify(relOut, null, 2),
  //     );
  //   }
  // }

  for (const record of utilityRecords) {
    const utilityRef = { "/": `./${record.file}` };
    let linkedToLayout = false;

    if (multiBuilding) {
      if (
        record.building_number != null &&
        buildingLayoutIndexByNumber.has(record.building_number)
      ) {
        const parentIndex = buildingLayoutIndexByNumber.get(record.building_number);
        const layoutFile = layoutIndexToFile.get(parentIndex);
        if (layoutFile) {
          const relFile = `relationship_layout_${parentIndex}_has_utility_${record.index}.json`;
          const relOut = {
            from: { "/": `./${layoutFile}` },
            to: utilityRef,
          };
          await fsp.writeFile(
            path.join("data", relFile),
            JSON.stringify(relOut, null, 2),
          );
          linkedToLayout = true;
        }
      }
    } else if (hasSingleBuildingLayout && primaryBuildingIndex != null) {
      const layoutFile = layoutIndexToFile.get(primaryBuildingIndex);
      if (layoutFile) {
        const relFile = `relationship_layout_${primaryBuildingIndex}_has_utility_${record.index}.json`;
        const relOut = {
          from: { "/": `./${layoutFile}` },
          to: utilityRef,
        };
        await fsp.writeFile(
          path.join("data", relFile),
          JSON.stringify(relOut, null, 2),
        );
        linkedToLayout = true;
      }
    }

    if (!linkedToLayout && propertyOut) {
      const relFile = `relationship_property_has_utility_${record.index}.json`;
      const relOut = {
        from: propertyRef,
        to: utilityRef,
      };
      await fsp.writeFile(
        path.join("data", relFile),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  for (const record of structureRecords) {
    const structureRef = { "/": `./${record.file}` };
    let linkedToLayout = false;

    if (multiBuilding) {
      if (
        record.building_number != null &&
        buildingLayoutIndexByNumber.has(record.building_number)
      ) {
        const parentIndex = buildingLayoutIndexByNumber.get(record.building_number);
        const layoutFile = layoutIndexToFile.get(parentIndex);
        if (layoutFile) {
          const relFile = `relationship_layout_${parentIndex}_has_structure_${record.index}.json`;
          const relOut = {
            from: { "/": `./${layoutFile}` },
            to: structureRef,
          };
          await fsp.writeFile(
            path.join("data", relFile),
            JSON.stringify(relOut, null, 2),
          );
          linkedToLayout = true;
        }
      }
    } else if (hasSingleBuildingLayout && primaryBuildingIndex != null) {
      const layoutFile = layoutIndexToFile.get(primaryBuildingIndex);
      if (layoutFile) {
        const relFile = `relationship_layout_${primaryBuildingIndex}_has_structure_${record.index}.json`;
        const relOut = {
          from: { "/": `./${layoutFile}` },
          to: structureRef,
        };
        await fsp.writeFile(
          path.join("data", relFile),
          JSON.stringify(relOut, null, 2),
        );
        linkedToLayout = true;
      }
    }

    if (!linkedToLayout && propertyOut) {
      const relFile = `relationship_property_has_structure_${record.index}.json`;
      const relOut = {
        from: propertyRef,
        to: structureRef,
      };
      await fsp.writeFile(
        path.join("data", relFile),
        JSON.stringify(relOut, null, 2),
      );
    }
  }

  // Files: collect key document/media links (excluding deed-related files now handled above)
  if (!isMulti) {
    const urls = new Set();
    $('a[href*="TrimPrint"]').each((i, a) => urls.add($(a).attr("href")));
    $('a[href*="/downloads/mapbook/"]').each((i, a) =>
      urls.add($(a).attr("href")),
    );
    $('a[href*="ImageSketches"], a[href*="imagesketches"]').each((i, a) =>
      urls.add($(a).attr("href")),
    );

    // Filter out URLs that were already processed as deed files (if any overlap)
    const processedDeedUrls = new Set(sales.map(s => s._book_page_url).filter(Boolean));
    const uniqueNonDeedUrls = [...urls].filter(u => !processedDeedUrls.has(u));

    let currentFileIdx = fileIdx; // Continue numbering from where deed files left off
    for (const u of uniqueNonDeedUrls) {
      currentFileIdx += 1;
      const fileFileName = `file_${currentFileIdx}.json`;
      const rec = {
        source_http_request: sourceHttpRequest, // Use the extracted sourceHttpRequest
        request_identifier: baseRequestData.request_identifier || null,
        file_format: getFileFormatFromUrl(u),
        name: path.basename(u || "") || null,
        original_url: u || null,
        ipfs_url: null,
        document_type: null,
      };
      // Map document_type to schema-compliant values
      // Changed "Miscellaneous" to null as "Miscellaneous" is not in the schema's enum.
      // If "TaxDocument" and "MapDocument" are truly, the schema must be updated.
      if (u.includes("TrimPrint")) rec.document_type = null; // Changed from "Miscellaneous" to null
      else if (u.includes("mapbook")) rec.document_type = null; // Changed from "Miscellaneous" to null
      else if (rec.file_format === "jpeg" || rec.file_format === "png") rec.document_type = "PropertyImage";
      else rec.document_type = null; // Default for other links, using null for schema compliance

      await fsp.writeFile(
        path.join("data", fileFileName),
        JSON.stringify(rec, null, 2),
      );
    }
  }
}

main().catch(async (err) => {
  const errMsg = {
    type: "error",
    message: err && err.message ? err.message : String(err),
    path: "scripts/data_extractor",
  };
  try {
    ensureDirSync("data");
    await fsp.writeFile(
      path.join("data", "error.json"),
      JSON.stringify(errMsg, null, 2),
    );
  } catch {}
  console.error(err);
  process.exit(1);
});
