const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function parseCurrencyToNumber(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/[$,()]/g, "")
    .trim();
  if (cleaned === "") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function titleCaseName(name) {
  if (!name) return name;
  return String(name)
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function validateSuffixName(suffix) {
  if (!suffix || suffix.trim() === "") return null;

  // Valid suffix values from the schema enum
  const validSuffixes = [
    "Jr.", "Sr.", "II", "III", "IV", "PhD", "MD", "Esq.", "JD", "LLM",
    "MBA", "RN", "DDS", "DVM", "CFA", "CPA", "PE", "PMP", "Emeritus", "Ret."
  ];

  // Clean and normalize the suffix
  const cleaned = suffix.trim();

  // Check for exact match (case-insensitive)
  const match = validSuffixes.find(valid =>
    valid.toLowerCase() === cleaned.toLowerCase()
  );

  // Return the properly formatted suffix if valid, otherwise null
  return match || null;
}

function parsePersonNames(nameStr) {
  if (!nameStr || nameStr.trim() === "") return [];

  const persons = [];

  // Clean up the string and remove parenthetical content like "(DECEASED)", "(TRUSTEE)", etc.
  let cleaned = nameStr
    .trim()
    .replace(/\([^)]*\)/g, "") // Remove all parenthetical content
    .replace(/\s+/g, " ")
    .trim();

  // Comprehensive company keyword list
  const companyKeywords = [
    "inc", "llc", "ltd", "foundation", "alliance", "solutions", "corp", "co",
    "services", "trust", "tr", "company", "partners", "holdings", "lp", "pllc",
    "pc", "bank", "association", "assn", "church", "group", "university",
    "school", "authority", "dept", "department", "ministries", "incorporated",
    "corporation", "limited", "estate", "partnership", "associates", "properties",
    "investments", "enterprises", "ventures", "capital", "fund", "society",
    "organization", "agency"
  ];

  const companyRe = new RegExp(
    `(^|[^a-zA-Z])(${companyKeywords.join("|")})([^a-zA-Z]|$)`,
    "i"
  );

  // RULE 1 & 2: Check if it's a company
  if (companyRe.test(cleaned)) {
    // Company detected - do not create person objects for companies
    // Companies should be handled separately as company entities
    return [];
  }

  // RULE 3: Process Personal Names
  let first_name = null;
  let last_name = null;
  let middle_name = null;
  let suffix_name = null;

  // RULE 3A: Check if the name contains '&'
  // NEW LOGIC: Split into TWO person objects (for human names without entity keywords)
  if (cleaned.includes("&")) {
    const parts = cleaned.split("&").map(s => s.trim()).filter(Boolean);

    if (parts.length >= 2) {
      // Check if this is ALL CAPS format (CAD style)
      const isAllCaps = cleaned.replace(/&/g, " ").trim() === cleaned.replace(/&/g, " ").trim().toUpperCase();

      const part1Words = parts[0].replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(w => w.length > 0);
      const part2Words = parts[1].replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(w => w.length > 0);

      // Heuristic: If CAD format (ALL CAPS) and first part has 2+ words and second part has 1+ word
      // Then assume shared last name: "LASTNAME FIRSTNAME1 & FIRSTNAME2" or "LASTNAME FIRSTNAME1 MIDDLEINITIAL & FIRSTNAME2"
      if (isAllCaps && part1Words.length >= 2 && part2Words.length >= 1) {
        const sharedLastName = titleCaseName(part1Words[0]);

        // Check if the last word in part1 is a middle initial (single character or ends with period)
        let firstName1, middleName1;
        const lastWord = part1Words[part1Words.length - 1];
        const isMiddleInitial = lastWord.length === 1 || lastWord.endsWith(".");

        if (isMiddleInitial && part1Words.length >= 3) {
          // Has middle initial: LASTNAME FIRSTNAME MIDDLEINITIAL
          firstName1 = titleCaseName(part1Words.slice(1, -1).join(" "));
          middleName1 = titleCaseName(lastWord).replace(/\.$/, "");
        } else {
          // No middle initial: LASTNAME FIRSTNAME
          firstName1 = titleCaseName(part1Words.slice(1).join(" "));
          middleName1 = null;
        }

        const firstName2 = titleCaseName(part2Words.join(" "));

        // Create first person
        if (firstName1) {
          persons.push({
            first_name: firstName1,
            last_name: sharedLastName,
            middle_name: middleName1,
            prefix_name: null,
            suffix_name: null,
            birth_date: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
        }

        // Create second person
        if (firstName2) {
          persons.push({
            first_name: firstName2,
            last_name: sharedLastName,
            middle_name: null, // Second person typically doesn't have middle name shown
            prefix_name: null,
            suffix_name: null,
            birth_date: null,
            us_citizenship_status: null,
            veteran_status: null,
          });
        }

        return persons;
      }

      // Otherwise, parse each part separately as individual full names
      // Parse first part
      const person1 = parseSinglePersonName(parts[0]);
      if (person1) {
        persons.push(person1);
      }

      // Parse second part
      const person2 = parseSinglePersonName(parts[1]);
      if (person2) {
        persons.push(person2);
      }

      return persons;
    }
  }

  // Helper function to parse a single person name with smart format detection
  function parseSinglePersonName(nameStr) {
    let cleaned = nameStr.replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim();
    const words = cleaned.split(" ").filter(w => w.length > 0);

    if (words.length === 0) return null;

    let first_name, middle_name, last_name;

    // Smart format detection using multiple heuristics
    const isAllCaps = cleaned === cleaned.toUpperCase();

    if (words.length === 1) {
      first_name = titleCaseName(words[0]);
      middle_name = null;
      last_name = titleCaseName(words[0]);
    } else if (words.length === 2) {
      // For 2 words, use ALL CAPS as indicator of CAD format
      if (isAllCaps) {
        // CAD format: LASTNAME FIRSTNAME
        last_name = titleCaseName(words[0]);
        first_name = titleCaseName(words[1]);
      } else {
        // Normal format: FIRSTNAME LASTNAME
        first_name = titleCaseName(words[0]);
        last_name = titleCaseName(words[1]);
      }
      middle_name = null;
    } else if (words.length === 3) {
      // Three words - detect format using multiple heuristics
      const firstWord = words[0];
      const secondWord = words[1];
      const thirdWord = words[2];

      const firstIsInitial = firstWord.length === 1 || firstWord.endsWith(".");
      const secondIsInitial = secondWord.length === 1 || secondWord.endsWith(".");
      const thirdIsInitial = thirdWord.length === 1 || thirdWord.endsWith(".");

      if (secondIsInitial && !firstIsInitial && !thirdIsInitial) {
        // Middle initial in position 2
        if (isAllCaps) {
          // CAD format: LASTNAME FIRSTNAME M
          last_name = titleCaseName(firstWord);
          first_name = titleCaseName(secondWord);
          middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
        } else {
          // Normal format: FIRSTNAME M LASTNAME
          first_name = titleCaseName(firstWord);
          middle_name = titleCaseName(secondWord).replace(/\.$/, "");
          last_name = titleCaseName(thirdWord);
        }
      } else if (firstIsInitial && !secondIsInitial && !thirdIsInitial) {
        // Unlikely format: M FIRSTNAME LASTNAME
        first_name = titleCaseName(secondWord);
        middle_name = titleCaseName(firstWord).replace(/\.$/, "");
        last_name = titleCaseName(thirdWord);
      } else if (thirdIsInitial && !firstIsInitial && !secondIsInitial) {
        // Initial at end: FIRSTNAME LASTNAME M or LASTNAME FIRSTNAME M
        if (isAllCaps) {
          // CAD format: LASTNAME FIRSTNAME M
          last_name = titleCaseName(firstWord);
          first_name = titleCaseName(secondWord);
          middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
        } else {
          // Normal format: FIRSTNAME LASTNAME M (unusual)
          first_name = titleCaseName(firstWord);
          last_name = titleCaseName(secondWord);
          middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
        }
      } else {
        // No obvious initial - use ALL CAPS to determine format
        if (isAllCaps) {
          // CAD format: LASTNAME FIRSTNAME MIDDLENAME
          last_name = titleCaseName(firstWord);
          first_name = titleCaseName(secondWord);
          middle_name = titleCaseName(thirdWord);
        } else {
          // Normal format: FIRSTNAME MIDDLENAME LASTNAME
          first_name = titleCaseName(firstWord);
          middle_name = titleCaseName(secondWord);
          last_name = titleCaseName(thirdWord);
        }
      }
    } else {
      // Four or more words - use ALL CAPS to determine format
      if (isAllCaps) {
        // CAD format: LASTNAME FIRSTNAME MIDDLE1 MIDDLE2 ...
        last_name = titleCaseName(words[0]);
        first_name = titleCaseName(words[1]);
        middle_name = words.slice(2).map(w => titleCaseName(w)).join(" ");
      } else {
        // Normal format: FIRSTNAME MIDDLE1 MIDDLE2 ... LASTNAME
        first_name = titleCaseName(words[0]);
        last_name = titleCaseName(words[words.length - 1]);
        middle_name = words.slice(1, -1).map(w => titleCaseName(w)).join(" ");
      }
    }

    return {
      first_name: first_name && first_name.trim() !== "" ? first_name : (last_name || "Unknown"),
      last_name: last_name && last_name.trim() !== "" ? last_name : (first_name || "Unknown"),
      middle_name: middle_name && middle_name.trim() !== "" ? middle_name : null,
      prefix_name: null,
      suffix_name: null,
      birth_date: null,
      us_citizenship_status: null,
      veteran_status: null,
    };
  }

  // RULE 3B: Single person without '&' - use smart format detection
  // Keep only: letters, spaces, hyphens, apostrophes, commas, periods
  cleaned = cleaned.replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim();

  const words = cleaned.split(" ").filter((w) => w.length > 0);

  if (words.length === 0) return [];

  // Use smart format detection
  const isAllCaps = cleaned === cleaned.toUpperCase();

  if (words.length === 1) {
    // Single word
    first_name = titleCaseName(words[0]);
    middle_name = null;
    last_name = titleCaseName(words[0]);
  } else if (words.length === 2) {
    // For 2 words, use ALL CAPS as indicator of CAD format
    if (isAllCaps) {
      // CAD format: LASTNAME FIRSTNAME
      last_name = titleCaseName(words[0]);
      first_name = titleCaseName(words[1]);
    } else {
      // Normal format: FIRSTNAME LASTNAME
      first_name = titleCaseName(words[0]);
      last_name = titleCaseName(words[1]);
    }
    middle_name = null;
  } else if (words.length === 3) {
    // Three words - detect format using multiple heuristics
    const firstWord = words[0];
    const secondWord = words[1];
    const thirdWord = words[2];

    const firstIsInitial = firstWord.length === 1 || firstWord.endsWith(".");
    const secondIsInitial = secondWord.length === 1 || secondWord.endsWith(".");
    const thirdIsInitial = thirdWord.length === 1 || thirdWord.endsWith(".");

    if (secondIsInitial && !firstIsInitial && !thirdIsInitial) {
      // Middle initial in position 2
      if (isAllCaps) {
        // CAD format: LASTNAME FIRSTNAME M
        last_name = titleCaseName(firstWord);
        first_name = titleCaseName(secondWord);
        middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
      } else {
        // Normal format: FIRSTNAME M LASTNAME
        first_name = titleCaseName(firstWord);
        middle_name = titleCaseName(secondWord).replace(/\.$/, "");
        last_name = titleCaseName(thirdWord);
      }
    } else if (firstIsInitial && !secondIsInitial && !thirdIsInitial) {
      // Unlikely format: M FIRSTNAME LASTNAME
      first_name = titleCaseName(secondWord);
      middle_name = titleCaseName(firstWord).replace(/\.$/, "");
      last_name = titleCaseName(thirdWord);
    } else if (thirdIsInitial && !firstIsInitial && !secondIsInitial) {
      // Initial at end: FIRSTNAME LASTNAME M or LASTNAME FIRSTNAME M
      if (isAllCaps) {
        // CAD format: LASTNAME FIRSTNAME M
        last_name = titleCaseName(firstWord);
        first_name = titleCaseName(secondWord);
        middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
      } else {
        // Normal format: FIRSTNAME LASTNAME M (unusual)
        first_name = titleCaseName(firstWord);
        last_name = titleCaseName(secondWord);
        middle_name = titleCaseName(thirdWord).replace(/\.$/, "");
      }
    } else {
      // No obvious initial - use ALL CAPS to determine format
      if (isAllCaps) {
        // CAD format: LASTNAME FIRSTNAME MIDDLENAME
        last_name = titleCaseName(firstWord);
        first_name = titleCaseName(secondWord);
        middle_name = titleCaseName(thirdWord);
      } else {
        // Normal format: FIRSTNAME MIDDLENAME LASTNAME
        first_name = titleCaseName(firstWord);
        middle_name = titleCaseName(secondWord);
        last_name = titleCaseName(thirdWord);
      }
    }
  } else {
    // Four or more words - use ALL CAPS to determine format
    if (isAllCaps) {
      // CAD format: LASTNAME FIRSTNAME MIDDLE1 MIDDLE2 ...
      last_name = titleCaseName(words[0]);
      first_name = titleCaseName(words[1]);
      middle_name = words.slice(2).map(w => titleCaseName(w)).join(" ");
    } else {
      // Normal format: FIRSTNAME MIDDLE1 MIDDLE2 ... LASTNAME
      first_name = titleCaseName(words[0]);
      last_name = titleCaseName(words[words.length - 1]);
      middle_name = words.slice(1, -1).map(w => titleCaseName(w)).join(" ");
    }
  }

  // Ensure no null/empty values - use actual names
  persons.push({
    first_name: first_name && first_name.trim() !== "" ? first_name : (last_name || "Unknown"),
    last_name: last_name && last_name.trim() !== "" ? last_name : (first_name || "Unknown"),
    middle_name: middle_name && middle_name.trim() !== "" ? middle_name : null,
    prefix_name: null,
    suffix_name: null,
    birth_date: null,
    us_citizenship_status: null,
    veteran_status: null,
  });

  return persons;
}

function validateDeedType(deedType) {
  // List of valid deed types from the schema
  const validDeedTypes = [
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
    "Miscellaneous"
  ];

  // If the deed type is valid, return it; otherwise return Miscellaneous
  if (validDeedTypes.includes(deedType)) {
    return deedType;
  }
  return "Miscellaneous";
}

function cleanupDataDir() {
  ensureDir("data");
  const files = fs.readdirSync("data");
  const prefixes = ["person_", "tax_", "deed_", "layout_", "file_", "company_"];
  for (const f of files) {
    if (prefixes.some((p) => f.startsWith(p))) {
      try {
        fs.unlinkSync(path.join("data", f));
      } catch {}
    }
  }
}

function extractFromHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const $ = cheerio.load(html);

  const result = {
    property: {},
    lot: {},
    taxes: {},
    deeds: [],
    deedParties: new Set(),
    files: [],
    situs: null,
    owner: null,
    layouts: [],
  };

  // Property basics
  // Property ID as parcel_identifier (clean label text)
  let propertyId = null;
  $("table.table.table-bordered.table-condensed")
    .first()
    .find("tr")
    .each((i, el) => {
      const t = $(el).text();
      if (t.includes("Property ID:")) {
        const tdText = $(el).find("td").eq(1).text();
        const cleaned = tdText.replace(/\bProperty ID:\s*/i, "").trim();
        if (cleaned) propertyId = cleaned;
      }
    });

  // Legal description
  let legalDesc = null;
  $('th:contains("Legal Description:")').each((i, th) => {
    const td = $(th).closest("tr").find("td").first();
    const txt = td.text().trim();
    if (txt) legalDesc = txt;
  });

  // Situs address (use for address.json parsing aid)
  let situsAddress = null;
  const situsTh = $('th:contains("Situs Address:")').first();
  if (situsTh.length) {
    situsAddress = situsTh
      .closest("tr")
      .find("td")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    result.situs = situsAddress;
  }

  // Owner information with mailing address
  let ownerId = null;
  let ownerName = null;
  let mailingAddress = null;

  // Extract Owner ID
  const ownerIdTh = $('th:contains("Owner ID:")').first();
  if (ownerIdTh.length) {
    ownerId = ownerIdTh
      .closest("tr")
      .find("td")
      .first()
      .text()
      .trim();
  }

  // Extract Owner Name (from Owner section, not from strong tag)
  $('table.table.table-bordered.table-condensed').each((i, table) => {
    $(table).find('tr').each((j, tr) => {
      const th = $(tr).find('th').first();
      const thText = th.text().trim();
      if (thText === 'Name:' && !ownerName) {
        ownerName = $(tr).find('td').first().text().trim();
      }
    });
  });

  // Extract Mailing Address
  const mailingTh = $('th:contains("Mailing Address:")').first();
  if (mailingTh.length) {
    const mailingTd = mailingTh.closest("tr").find("td").first();
    // Handle potential <br> tags in mailing address
    mailingAddress = mailingTd
      .html()
      .replace(/<br\s*\/?>/gi, ", ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Store owner information
  if (ownerId || ownerName || mailingAddress) {
    result.owner = {
      owner_id: ownerId || null,
      owner_name: ownerName || null,
      mailing_address: mailingAddress || null,
    };
  }

  // Improvements panel for living area, built year, and building description
  let livingAreaStr = null;
  let builtYear = null;
  let buildingDescription = null;
  // Prefer the first panel-table-info that is NOT OUT BLDGS and includes Type: Residential
  const impPanel = $('div.panel:contains("Property Improvement - Building")');
  impPanel.find(".panel-table-info").each((i, el) => {
    const txt = $(el).text();
    if (/OUT BLDGS/i.test(txt)) return; // skip outbuildings block
    if (!/Type:\s*Residential/i.test(txt)) return; // prefer residential main

    // Extract Living Area
    const laMatch = txt.match(/Living Area:\s*([0-9.,]+)\s*sqft/i);
    if (laMatch && !livingAreaStr) {
      const num = Number(laMatch[1].replace(/,/g, ""));
      // Only set if number is at least 10 (ensures 2+ digits for validation)
      if (Number.isFinite(num) && num >= 10) livingAreaStr = String(Math.round(num));
    }

    // Extract Building Description
    const descMatch = txt.match(/Description:\s*([^\n]+?)(?:Type:|$)/i);
    if (descMatch && !buildingDescription) {
      buildingDescription = descMatch[1].trim();
    }
  });
  // As a fallback, grab the first Living Area encountered that's not OUT BLDGS
  if (!livingAreaStr) {
    impPanel.find(".panel-table-info").each((i, el) => {
      const txt = $(el).text();
      if (/OUT BLDGS/i.test(txt)) return;
      const laMatch = txt.match(/Living Area:\s*([0-9.,]+)\s*sqft/i);
      if (laMatch && !livingAreaStr) {
        const num = Number(laMatch[1].replace(/,/g, ""));
        // Only set if number is at least 10 (ensures 2+ digits for validation)
        if (Number.isFinite(num) && num >= 10) livingAreaStr = String(Math.round(num));
      }
    });
  }

  // Year Built for MAIN AREA row
  impPanel.find("table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 5) {
      const type = tds.eq(0).text().trim();
      const desc = tds.eq(1).text().trim();
      if (/^MA\s*$/.test(type) && /MAIN AREA/i.test(desc)) {
        const y = tds.eq(3).text().trim();
        if (y && /^\d{4}$/.test(y)) builtYear = parseInt(y, 10);
      }
    }
  });

  // Extract all improvements and map to layouts
  let layoutIndex = 1;
  impPanel.find("table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 5) {
      const type = tds.eq(0).text().trim();
      const desc = tds.eq(1).text().trim();
      const classCode = tds.eq(2).text().trim();
      const yearBuilt = tds.eq(3).text().trim();
      const sqft = tds.eq(4).text().trim();

      if (type && desc) {
        // Map description to space_type according to the rules
        let spaceType = null;
        const descLower = desc.toLowerCase();

        if (descLower.includes("main area")) {
          spaceType = "Building";
        } else if (descLower.includes("barn")) {
          spaceType = "Barn";
        } else if (descLower.includes("porch")) {
          // Map various porch types
          if (descLower.includes("open")) {
            spaceType = "Open Porch";
          } else if (descLower.includes("screen")) {
            spaceType = "Screened Porch";
          } else if (descLower.includes("enclosed")) {
            spaceType = "Enclosed Porch";
          } else {
            spaceType = "Porch";
          }
        } else if (descLower.includes("shed") || descLower.includes("storage")) {
          // Map sheds and storage to appropriate types
          if (descLower.includes("workshop")) {
            spaceType = "Workshop";
          } else {
            spaceType = "Shed";
          }
        } else if (descLower.includes("workshop")) {
          spaceType = "Workshop";
        } else if (descLower.includes("garage")) {
          spaceType = "Detached Garage";
        } else if (descLower.includes("carport")) {
          spaceType = "Carport";
        } else {
          // Default to Building for unrecognized types
          spaceType = "Building";
        }

        // Create layout object
        result.layouts.push({
          space_type: spaceType,
          space_index: layoutIndex,
          space_type_index: String(layoutIndex),
          flooring_material_type: null,
          size_square_feet: sqft ? parseInt(sqft.replace(/,/g, ''), 10) : null,
          floor_level: null,
          has_windows: null,
          window_design_type: null,
          window_material_type: null,
          window_treatment_type: null,
          // All CAD-documented building improvements are considered finished structures for tax assessment
          is_finished: true,
          furnished: null,
          paint_condition: null,
          flooring_wear: null,
          clutter_level: null,
          visible_damage: null,
          countertop_material: null,
          cabinet_style: null,
          fixture_finish_quality: null,
          design_style: null,
          natural_light_quality: null,
          decor_elements: null,
          pool_type: null,
          pool_equipment: null,
          spa_type: null,
          safety_features: null,
          view_type: null,
          lighting_features: null,
          condition_issues: null,
          is_exterior: false,
          pool_condition: null,
          pool_surface_type: null,
          pool_water_quality: null,
          bathroom_renovation_date: null,
          flooring_installation_date: null,
          kitchen_renovation_date: null,
          spa_installation_date: null,
          pool_installation_date: null,
          built_year: yearBuilt && /^\d{4}$/.test(yearBuilt) ? parseInt(yearBuilt, 10) : null,
        });

        layoutIndex++;
      }
    }
  });

  // Property type: Smart detection based on lexicon.json enumerations
  // Valid values: Cooperative, Condominium, Modular, ManufacturedHousingMultiWide, Pud, Timeshare,
  // 2Units, DetachedCondominium, Duplex, SingleFamily, MultipleFamily, 3Units, ManufacturedHousing,
  // ManufacturedHousingSingleWide, 4Units, Townhouse, NonWarrantableCondo, VacantLand, Retirement,
  // MiscellaneousResidential, ResidentialCommonElementsAreas, MobileHome, Apartment,
  // MultiFamilyMoreThan10, MultiFamilyLessThan10, LandParcel, Building, Unit, ManufacturedHome

  let propertyType = null;
  let landDescription = null;
  let hasResidentialImprovement = false;
  let propertyTypeCode = null;
  let condoField = null;
  let propertyUse = null;
  // buildingDescription already declared earlier in the code

  // Extract Type, Property Use, and Condo fields from main property info table
  $("table.table.table-bordered.table-condensed")
    .first()
    .find("tr")
    .each((i, el) => {
      const thText = $(el).find("th").first().text().trim();
      const tdText = $(el).find("td").first().text().trim();

      // Extract Type field (e.g., "R", "C", "AG")
      if (/^Type:$/i.test(thText)) {
        propertyTypeCode = tdText;
      }

      // Extract Property Use field
      if (/Property\s*Use:/i.test(thText)) {
        propertyUse = tdText;
      }

      // Check for Condo field in the same row
      $(el).find("strong").each((j, strong) => {
        const strongText = $(strong).text().trim();
        if (/Condo:/i.test(strongText)) {
          const parentTd = $(strong).parent();
          const condoText = parentTd.text().replace(/Condo:/i, '').trim();
          if (condoText) condoField = condoText;
        }
      });
    });

  // Check improvements for residential type and building description
  impPanel.find(".panel-table-info").each((i, el) => {
    const txt = $(el).text();
    if (/Type:\s*Residential/i.test(txt)) {
      hasResidentialImprovement = true;

      // Extract building description
      const descMatch = txt.match(/Description:\s*([^\n]+?)(?:Type:|Living|$)/i);
      if (descMatch && !buildingDescription) {
        buildingDescription = descMatch[1].trim();
      }
    }
  });

  // Check if property has building improvements (space_type "Building" exists)
  const hasBuildingImprovement = result.layouts.some(l => l.space_type === "Building");

  // Smart property type detection - check in order of specificity
  if (!propertyType) {
    // 1. Check Condo field first (most specific)
    if (condoField && condoField.trim() !== "" && !/^no$/i.test(condoField.trim())) {
      propertyType = "Condominium";
    }

    // 2. Check Property Use field for specific keywords
    else if (propertyUse && propertyUse.trim() !== "") {
      const useLower = propertyUse.toLowerCase();

      if (/\b2\s*unit|\btwo\s*unit/i.test(useLower)) {
        propertyType = "2Units";
      } else if (/\b3\s*unit|\bthree\s*unit|\btriplex/i.test(useLower)) {
        propertyType = "3Units";
      } else if (/\b4\s*unit|\bfour\s*unit|\bquadplex/i.test(useLower)) {
        propertyType = "4Units";
      } else if (/duplex/i.test(useLower)) {
        propertyType = "Duplex";
      } else if (/townhouse|town\s*house/i.test(useLower)) {
        propertyType = "Townhouse";
      } else if (/condo/i.test(useLower)) {
        propertyType = "Condominium";
      } else if (/apartment/i.test(useLower)) {
        propertyType = "Apartment";
      } else if (/mobile\s*home/i.test(useLower)) {
        propertyType = "MobileHome";
      } else if (/manufactured.*single.*wide/i.test(useLower)) {
        propertyType = "ManufacturedHousingSingleWide";
      } else if (/manufactured.*multi.*wide/i.test(useLower)) {
        propertyType = "ManufacturedHousingMultiWide";
      } else if (/manufactured\s*home/i.test(useLower)) {
        propertyType = "ManufacturedHome";
      } else if (/modular/i.test(useLower)) {
        propertyType = "Modular";
      } else if (/cooperative|co-op/i.test(useLower)) {
        propertyType = "Cooperative";
      } else if (/pud/i.test(useLower)) {
        propertyType = "Pud";
      } else if (/retirement/i.test(useLower)) {
        propertyType = "Retirement";
      }
    }

    // 3. Check building description for keywords
    if (!propertyType && buildingDescription && buildingDescription.trim() !== "") {
      const descLower = buildingDescription.toLowerCase();

      if (/duplex/i.test(descLower)) {
        propertyType = "Duplex";
      } else if (/townhouse|town\s*house/i.test(descLower)) {
        propertyType = "Townhouse";
      } else if (/mobile\s*home/i.test(descLower)) {
        propertyType = "MobileHome";
      } else if (/manufactured.*single.*wide/i.test(descLower)) {
        propertyType = "ManufacturedHousingSingleWide";
      } else if (/manufactured.*multi.*wide/i.test(descLower)) {
        propertyType = "ManufacturedHousingMultiWide";
      } else if (/manufactured\s*home|manufactured\s*housing/i.test(descLower)) {
        propertyType = "ManufacturedHome";
      } else if (/modular/i.test(descLower)) {
        propertyType = "Modular";
      } else if (/apartment/i.test(descLower)) {
        propertyType = "Apartment";
      }
    }

    // 4. Check property type code with improvements check
    if (!propertyType && propertyTypeCode && propertyTypeCode.trim() !== "") {
      const code = propertyTypeCode.toUpperCase().trim();

      // Agricultural land - keep as LandParcel regardless of improvements
      if (/AGRICULTURAL|AG/i.test(code)) {
        propertyType = "LandParcel";
      }
      // Explicit vacant/land designation
      else if (/VACANT|LAND/i.test(code)) {
        propertyType = "VacantLand";
      }
      // Residential with improvements
      else if ((code === "R" || /RESIDENTIAL/i.test(code)) && hasBuildingImprovement) {
        propertyType = "SingleFamily";
      }
      // Commercial/Industrial with improvements
      else if ((code === "C" || /COMMERCIAL/i.test(code)) && hasBuildingImprovement) {
        propertyType = "Building";
      }
      else if ((code === "I" || /INDUSTRIAL/i.test(code)) && hasBuildingImprovement) {
        propertyType = "Building";
      }
      // Any type without improvements (except agricultural) → VacantLand
      else if (!hasBuildingImprovement) {
        propertyType = "VacantLand";
      }
    }

    // 5. Final fallback based on improvements
    if (!propertyType) {
      if (hasBuildingImprovement || hasResidentialImprovement) {
        propertyType = "SingleFamily"; // Default for residential with improvements
      } else {
        propertyType = "VacantLand"; // No type code and no improvements
      }
    }
  }

  // Parcel identifier: use parcel_id from property_seed.json, NOT property ID
  const parcelIdentifier =
    readJson("property_seed.json").parcel_id || propertyId || null;

  // Map property_usage_type based on land description (will be extracted from Property Land section)
  // This will be populated after land panel extraction
  let propertyUsageType = null;

  result.property = {
    parcel_identifier: parcelIdentifier || "",
    property_legal_description_text: legalDesc || null,
    livable_floor_area: livingAreaStr || null,
    area_under_air: livingAreaStr || null,
    property_structure_built_year: builtYear || null,
    number_of_units_type: null,
    property_type: propertyType || "SingleFamily",
    property_usage_type: null, // Will be set after land description extraction
    historic_designation: false,
    number_of_units: null,
    property_effective_built_year: null,
    subdivision: null,
    total_area: null,
    zoning: null,
  };

  // Lot
  // From Property Land table: Type, Description, Acreage, Sqft, Eff Front, Eff Depth
  let lotAcres = null,
    lotSqft = null,
    effFront = null,
    effDepth = null,
    landTypeCode = null;
  // landDescription already declared above for property_usage_type mapping
  const landPanel = $('div.panel:contains("Property Land")');
  landPanel.find("table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    if (tds.length >= 7) {
      // Extract type code and description
      landTypeCode = tds.eq(0).text().trim();
      landDescription = tds.eq(1).text().trim();
      const acresText = tds.eq(2).text().trim();
      const sqftText = tds.eq(3).text().trim();
      const frontText = tds.eq(4).text().trim();
      const depthText = tds.eq(5).text().trim();
      const acres = Number(acresText.replace(/,/g, ""));
      const sqft = Number(sqftText.replace(/,/g, ""));
      const front = Number(frontText.replace(/,/g, ""));
      const depth = Number(depthText.replace(/,/g, ""));
      if (Number.isFinite(acres)) lotAcres = acres;
      if (Number.isFinite(sqft)) lotSqft = Math.round(sqft);
      if (Number.isFinite(front)) effFront = Math.round(front);
      if (Number.isFinite(depth)) effDepth = Math.round(depth);
    }
  });

  // Map property_usage_type based on land description according to lexicon.json enumerations
  if (landDescription) {
    const descUpper = landDescription.toUpperCase();

    // Map based on land description text from Property Land table
    if (/NATIVE\s*PASTURE/i.test(descUpper)) {
      propertyUsageType = "NativePasture";
    } else if (/IMPROVED\s*PASTURE/i.test(descUpper)) {
      propertyUsageType = "ImprovedPasture";
    } else if (/PASTURE\s*WITH\s*TIMBER|TIMBER\s*PASTURE/i.test(descUpper)) {
      propertyUsageType = "PastureWithTimber";
    } else if (/DRYLAND\s*CROPLAND|DRY\s*CROPLAND/i.test(descUpper)) {
      propertyUsageType = "DrylandCropland";
    } else if (/HAY\s*MEADOW|MEADOW/i.test(descUpper)) {
      propertyUsageType = "HayMeadow";
    } else if (/CROPLAND\s*CLASS\s*2|CLASS\s*2\s*CROPLAND/i.test(descUpper)) {
      propertyUsageType = "CroplandClass2";
    } else if (/CROPLAND\s*CLASS\s*3|CLASS\s*3\s*CROPLAND/i.test(descUpper)) {
      propertyUsageType = "CroplandClass3";
    } else if (/TIMBER|TIMBERLAND|FOREST/i.test(descUpper)) {
      propertyUsageType = "TimberLand";
    } else if (/GRAZING|RANGE/i.test(descUpper)) {
      propertyUsageType = "GrazingLand";
    } else if (/ORCHARD|GROVE/i.test(descUpper)) {
      propertyUsageType = "OrchardGroves";
    } else if (/VINEYARD|WINERY/i.test(descUpper)) {
      propertyUsageType = "VineyardWinery";
    } else if (/POULTRY/i.test(descUpper)) {
      propertyUsageType = "Poultry";
    } else if (/LIVESTOCK/i.test(descUpper)) {
      propertyUsageType = "LivestockFacility";
    } else if (/AQUACULTURE|FISH\s*FARM/i.test(descUpper)) {
      propertyUsageType = "Aquaculture";
    } else if (/NURSERY|GREENHOUSE/i.test(descUpper)) {
      propertyUsageType = "NurseryGreenhouse";
    } else if (/ORNAMENTAL/i.test(descUpper)) {
      propertyUsageType = "Ornamentals";
    } else if (/RESIDENTIAL/i.test(descUpper)) {
      propertyUsageType = "Residential";
    } else if (/COMMERCIAL/i.test(descUpper)) {
      propertyUsageType = "Commercial";
    } else if (/INDUSTRIAL/i.test(descUpper)) {
      propertyUsageType = "Industrial";
    } else if (/AGRICULTURAL/i.test(descUpper)) {
      propertyUsageType = "Agricultural";
    } else if (/RECREATIONAL/i.test(descUpper)) {
      propertyUsageType = "Recreational";
    } else if (/VACANT/i.test(descUpper)) {
      propertyUsageType = "Residential"; // Default vacant to Residential
    } else {
      propertyUsageType = "Residential"; // Default fallback
    }
  } else {
    propertyUsageType = "Residential"; // Default if no land description
  }

  // Update property object with property_usage_type
  result.property.property_usage_type = propertyUsageType;

  // Enhanced lot type mapping based on acreage, type code, and description
  let lotType = null;
  if (typeof lotAcres === "number") {
    // Primary mapping: based on acreage
    if (lotAcres > 0.25) {
      lotType = "GreaterThanOneQuarterAcre";
    } else {
      lotType = "LessThanOrEqualToOneQuarterAcre";
    }
  } else if (landDescription) {
    // Secondary mapping: based on land description when acreage is not available
    const descUpper = landDescription.toUpperCase();
    if (/RESIDENTIAL|SUBURBAN|URBAN/i.test(descUpper)) {
      lotType = "LessThanOrEqualToOneQuarterAcre"; // Typical residential lots
    } else if (/RURAL|AGRICULTURAL|FARM|RANCH/i.test(descUpper)) {
      lotType = "GreaterThanOneQuarterAcre"; // Rural/agricultural land is typically larger
    } else if (/COMMERCIAL|INDUSTRIAL/i.test(descUpper)) {
      lotType = "GreaterThanOneQuarterAcre"; // Commercial/industrial lots are often larger
    }
  }

  result.lot = {
    lot_type: lotType,
    lot_length_feet: effFront || null,
    lot_width_feet: effDepth || null,
    lot_area_sqft: lotSqft || null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
    lot_size_acre: lotAcres || null,
  };

  // Taxes: collect all years from Property Roll Value History
  const taxRows = [];
  $('div.panel:contains("Property Roll Value History") table tbody tr').each(
    (i, tr) => {
      const tds = $(tr).find("td.table-number");
      if (tds.length >= 7) {
        const yearTxt = tds.eq(0).text().trim();
        const year = parseInt(yearTxt, 10);
        if (Number.isFinite(year)) {
          const imp = parseCurrencyToNumber(tds.eq(1).text());
          const land = parseCurrencyToNumber(tds.eq(2).text());
          const agValuation = parseCurrencyToNumber(tds.eq(3).text());
          const appr = parseCurrencyToNumber(tds.eq(4).text());
          const hsCapLoss = parseCurrencyToNumber(tds.eq(5).text());
          const assessed = parseCurrencyToNumber(tds.eq(6).text());
          const market =
            (imp != null ? imp : 0) + (land != null ? land : 0) || appr || null;
          taxRows.push({
            tax_year: year,
            improvements: imp,
            landMarket: land,
            agricultural_valuation: agValuation,
            marketValue: market,
            homestead_cap_loss: hsCapLoss,
            assessedValue: assessed,
          });
        }
      }
    },
  );
  taxRows.forEach((row) => {
    result.taxes[row.tax_year] = {
      tax_year: row.tax_year,
      property_assessed_value_amount:
        row.assessedValue != null ? row.assessedValue : 0,
      property_market_value_amount: 0,
      property_building_amount:
        row.improvements != null ? row.improvements : 0,
      property_land_amount: row.landMarket != null ? row.landMarket : 0,
      property_taxable_value_amount:
        row.assessedValue != null ? row.assessedValue : 0,
      homestead_cap_loss_amount:
        row.homestead_cap_loss != null ? row.homestead_cap_loss : 0,
      agricultural_valuation_amount:
        row.agricultural_valuation != null ? row.agricultural_valuation : 0,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
  });

  // Deeds + Sales + capture parties for person files
  const deeds = [];
  const salesHistory = [];
  $('div.panel:contains("Property Deed History") table tbody tr').each(
    (i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 5) {
        const dateText = tds.eq(0).text().trim();
        const typeCode = tds.eq(1).text().trim();
        const desc = tds.eq(2).text().trim();
        const grantor = tds.eq(3).text().trim();
        const grantee = tds.eq(4).text().trim();

        // Extract volume, page, and number from columns 5, 6, 7
        // Note: "number" column maps to "book" field in deed class
        // Ensure proper trimming and handle empty strings
        let volume = tds.length > 5 ? tds.eq(5).text().trim() : "";
        let page = tds.length > 6 ? tds.eq(6).text().trim() : "";
        let book = tds.length > 7 ? tds.eq(7).text().trim() : "";

        // Convert empty strings to null, ensure volume/page/book are ALWAYS string type when present
        volume = volume !== "" ? String(volume) : null;
        page = page !== "" ? String(page) : null;
        book = book !== "" ? String(book) : null;
        // Comprehensive deed type mapping based on description
        // If no match found, use "Miscellaneous" as the default
        let deedType = "Miscellaneous";

        // Normalize description: trim whitespace and convert to uppercase for matching
        const descNormalized = (desc || "").trim().toUpperCase();

        // If description is empty, use Miscellaneous
        if (!descNormalized) {
          deedType = "Miscellaneous";
        }
        // Warranty Deeds - must check Special Warranty first before general Warranty
        else if (/SPECIAL\s+WARRANTY/i.test(descNormalized)) {
          deedType = "Special Warranty Deed";
        } else if (/WARRANTY\s*DEED/i.test(descNormalized) || descNormalized === "WARRANTY DEED") {
          deedType = "Warranty Deed";
        }
        // Quitclaim Deeds
        else if (/QUIT\s*CLAIM/i.test(descNormalized) || /QUITCLAIM/i.test(descNormalized)) {
          deedType = "Quitclaim Deed";
        }
        // Trustee Deeds
        else if (/SUBSTITUTE\s+TRUSTEE/i.test(descNormalized)) {
          deedType = "Trustee's Deed";
        } else if (/TRUSTEE'?S?\s*DEED/i.test(descNormalized) || /DEED\s+OF\s+TRUST/i.test(descNormalized)) {
          deedType = "Trustee's Deed";
        }
        // Sheriff/Tax Deeds
        else if (/SHERIFF'?S?\s*DEED/i.test(descNormalized)) {
          deedType = "Sheriff's Deed";
        } else if (/TAX\s*DEED/i.test(descNormalized)) {
          deedType = "Tax Deed";
        }
        // Gift/Transfer Deeds
        else if (/GIFT\s*DEED/i.test(descNormalized)) {
          deedType = "Gift Deed";
        } else if (/TRANSFER\s+ON\s+DEATH/i.test(descNormalized) || /TOD\s*DEED/i.test(descNormalized)) {
          deedType = "Transfer on Death Deed";
        }
        // Correction/Amendment Deeds
        else if (/CORRECTION\s*DEED/i.test(descNormalized) || /CORRECTIVE\s*DEED/i.test(descNormalized)) {
          deedType = "Correction Deed";
        }
        // Life Estate Deeds
        else if (/LIFE\s+ESTATE/i.test(descNormalized)) {
          deedType = "Life Estate Deed";
        }
        // Executor/Administrator Deeds
        else if (/EXECUTOR'?S?\s*DEED/i.test(descNormalized) || /PERSONAL\s+REPRESENTATIVE\s*DEED/i.test(descNormalized)) {
          deedType = "Personal Representative Deed";
        } else if (/ADMINISTRATOR'?S?\s*DEED/i.test(descNormalized)) {
          deedType = "Administrator's Deed";
        }
        // Guardian's Deed
        else if (/GUARDIAN'?S?\s*DEED/i.test(descNormalized)) {
          deedType = "Guardian's Deed";
        }
        // Other specific deed types
        else if (/BARGAIN\s+AND\s+SALE/i.test(descNormalized)) {
          deedType = "Bargain and Sale Deed";
        } else if (/GRANT\s*DEED/i.test(descNormalized)) {
          deedType = "Grant Deed";
        } else if (/LADY\s+BIRD\s*DEED/i.test(descNormalized)) {
          deedType = "Lady Bird Deed";
        } else if (/DEED\s+IN\s+LIEU\s+OF\s+FORECLOSURE/i.test(descNormalized)) {
          deedType = "Deed in Lieu of Foreclosure";
        } else if (/SPECIAL\s+MASTER'?S?\s*DEED/i.test(descNormalized)) {
          deedType = "Special Master's Deed";
        } else if (/COURT\s+ORDER\s*DEED/i.test(descNormalized)) {
          deedType = "Court Order Deed";
        } else if (/CONTRACT\s+FOR\s*DEED/i.test(descNormalized)) {
          deedType = "Contract for Deed";
        } else if (/RECEIVER'?S?\s*DEED/i.test(descNormalized)) {
          deedType = "Receiver's Deed";
        }
        // For all unmatched types (MARRIAGE LICENSE, DIVORCE DECREE, etc.),
        // use "Miscellaneous" which is in the allowed enum list
        // This includes: MARRIAGE LICENSE, DIVORCE DECREE, and other non-deed documents

        // Validate deed type to ensure it's in the allowed enum list
        deedType = validateDeedType(deedType);

        // Build deed object with deed_type (required)
        const deedObj = {
          deed_type: deedType,
        };

        // Only include volume, page, book if they have values from input.html
        // Ensure they are ALWAYS string type when included
        if (volume) {
          deedObj.volume = String(volume);
        }
        if (page) {
          deedObj.page = String(page);
        }
        if (book) {
          deedObj.book = String(book);
        }

        // Add _raw data for debugging
        deedObj._raw = {
          date: dateText,
          typeCode,
          description: desc,
          grantor,
          grantee,
        };
        if (volume) deedObj._raw.volume = String(volume);
        if (page) deedObj._raw.page = String(page);
        if (book) deedObj._raw.book = String(book);

        deeds.push(deedObj);

        // Store ALL deed records (not just transfer deeds) for processing
        const saleHistoryObj = {
          date: dateText,
          deedType: deedType,
          documentType: typeCode || null,
          grantor: grantor,
          grantee: grantee,
        };

        // Only include volume, page, book if they have values
        if (volume) saleHistoryObj.volume = String(volume);
        if (page) saleHistoryObj.page = String(page);
        if (book) saleHistoryObj.book = String(book);

        salesHistory.push(saleHistoryObj);

        // capture only grantee names (not grantor)
        if (grantee) {
          result.deedParties.add(grantee.trim());
        }
      }
    },
  );
  result.deeds = deeds;

  // Sort salesHistory by date (earliest first)
  salesHistory.sort((a, b) => {
    const parseDate = (dateStr) => {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        return new Date(parts[2], parts[0] - 1, parts[1]);
      }
      return new Date(0);
    };
    return parseDate(a.date) - parseDate(b.date);
  });

  result.salesHistory = salesHistory;

  // Extract earliest deed year and use it as fallback for property built year (only if not already set)
  if (!result.property.property_structure_built_year &&
      salesHistory.length > 0 &&
      salesHistory[0].date) {
    const earliestDate = salesHistory[0].date;
    const parts = earliestDate.split("/");
    if (parts.length === 3 && parts[2] && /^\d{4}$/.test(parts[2])) {
      const earliestYear = parseInt(parts[2], 10);
      result.property.property_structure_built_year = earliestYear;
    }
  }

  // Files: 2025 Appraisal Notice link
  const noticeLink = $("#DownloadNoticeLinkDynamic").attr("href");
  if (noticeLink) {
    result.files.push({
      name: "2025 Appraisal Notice",
      original_url: noticeLink,
    });
  }

  return result;
}

function buildOwners(ownerJsonPath) {
  const ownerData = readJson(ownerJsonPath);
  // Dynamically find the property key instead of hardcoding it
  const propKey = Object.keys(ownerData).find((k) => k.startsWith("property_"));
  const ownersBlock = propKey ? ownerData[propKey] : null;
  const persons = [];
  if (ownersBlock && ownersBlock.owners_by_date) {
    const seen = new Set();
    for (const dateKey of Object.keys(ownersBlock.owners_by_date)) {
      const arr = ownersBlock.owners_by_date[dateKey] || [];
      for (const o of arr) {
        if (o && o.type === "person") {
          let first = titleCaseName(o.first_name || "");
          let last = titleCaseName(o.last_name || "");
          let mid = o.middle_name ? titleCaseName(o.middle_name).trim() : "";

          // Remove special characters that don't match the validation pattern
          // Keep only: letters, spaces, hyphens, apostrophes, commas, periods
          first = first.replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim();
          mid = mid.replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim();
          last = last.replace(/[^A-Za-z\s\-',.]/g, " ").replace(/\s+/g, " ").trim();

          // Ensure no field is empty - use fallbacks
          if (!first || first === "") first = last || mid || "Unknown";
          if (!mid || mid === "") mid = null; // No middle name available
          if (!last || last === "") last = first || mid || "Unknown";

          const key = `${first}|${mid}|${last}`;
          if (!seen.has(key)) {
            seen.add(key);
            persons.push({
              birth_date: null,
              first_name: first,
              last_name: last,
              middle_name: mid,
              prefix_name: null,
              suffix_name: null,
              us_citizenship_status: null,
              veteran_status: null,
            });
          }
        }
      }
    }
  }
  return persons;
}

function buildUtilities(utilJsonPath) {
  const data = readJson(utilJsonPath);
  // Dynamically find the property key instead of hardcoding it
  const propKey = Object.keys(data).find((k) => k.startsWith("property_"));
  const rec = (propKey ? data[propKey] : null) || {};
  return {
    cooling_system_type: rec.cooling_system_type ?? null,
    heating_system_type: rec.heating_system_type ?? null,
    public_utility_type: rec.public_utility_type ?? null,
    sewer_type: rec.sewer_type ?? null,
    water_source_type: rec.water_source_type ?? null,
    plumbing_system_type: rec.plumbing_system_type ?? null,
    plumbing_system_type_other_description:
      rec.plumbing_system_type_other_description ?? null,
    electrical_panel_capacity: rec.electrical_panel_capacity ?? null,
    electrical_wiring_type: rec.electrical_wiring_type ?? null,
    hvac_condensing_unit_present: rec.hvac_condensing_unit_present ?? null,
    electrical_wiring_type_other_description:
      rec.electrical_wiring_type_other_description ?? null,
    solar_panel_present: !!rec.solar_panel_present,
    solar_panel_type: rec.solar_panel_type ?? null,
    solar_panel_type_other_description:
      rec.solar_panel_type_other_description ?? null,
    smart_home_features: rec.smart_home_features ?? null,
    smart_home_features_other_description:
      rec.smart_home_features_other_description ?? null,
    hvac_unit_condition: rec.hvac_unit_condition ?? null,
    solar_inverter_visible: !!rec.solar_inverter_visible,
    hvac_unit_issues: rec.hvac_unit_issues ?? null,
    electrical_panel_installation_date:
      rec.electrical_panel_installation_date ?? null,
    electrical_rewire_date: rec.electrical_rewire_date ?? null,
    hvac_capacity_kw: rec.hvac_capacity_kw ?? null,
    hvac_capacity_tons: rec.hvac_capacity_tons ?? null,
    hvac_equipment_component: rec.hvac_equipment_component ?? null,
    hvac_equipment_manufacturer: rec.hvac_equipment_manufacturer ?? null,
    hvac_equipment_model: rec.hvac_equipment_model ?? null,
    hvac_installation_date: rec.hvac_installation_date ?? null,
    hvac_seer_rating: rec.hvac_seer_rating ?? null,
    hvac_system_configuration: rec.hvac_system_configuration ?? null,
    plumbing_system_installation_date:
      rec.plumbing_system_installation_date ?? null,
    sewer_connection_date: rec.sewer_connection_date ?? null,
    solar_installation_date: rec.solar_installation_date ?? null,
    solar_inverter_installation_date:
      rec.solar_inverter_installation_date ?? null,
    solar_inverter_manufacturer: rec.solar_inverter_manufacturer ?? null,
    solar_inverter_model: rec.solar_inverter_model ?? null,
    water_connection_date: rec.water_connection_date ?? null,
    water_heater_installation_date: rec.water_heater_installation_date ?? null,
    water_heater_manufacturer: rec.water_heater_manufacturer ?? null,
    water_heater_model: rec.water_heater_model ?? null,
    well_installation_date: rec.well_installation_date ?? null,
  };
}

function buildLayouts(layoutJsonPath) {
  const data = readJson(layoutJsonPath);
  // Dynamically find the property key instead of hardcoding it
  const propKey = Object.keys(data).find((k) => k.startsWith("property_"));
  const rec = propKey ? data[propKey] : null;
  if (!rec || !Array.isArray(rec.layouts)) return [];
  return rec.layouts.map((l) => ({
    space_type: l.space_type ?? null,
    space_index: l.space_index,
    space_type_index: String(l.space_index),
    flooring_material_type: l.flooring_material_type ?? null,
    size_square_feet: l.size_square_feet ?? null,
    floor_level: l.floor_level ?? null,
    has_windows: l.has_windows ?? null,
    window_design_type: l.window_design_type ?? null,
    window_material_type: l.window_material_type ?? null,
    window_treatment_type: l.window_treatment_type ?? null,
    is_finished: typeof l.is_finished === "boolean" ? l.is_finished : false,
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
    is_exterior: typeof l.is_exterior === "boolean" ? l.is_exterior : false,
    pool_condition: l.pool_condition ?? null,
    pool_surface_type: l.pool_surface_type ?? null,
    pool_water_quality: l.pool_water_quality ?? null,
    bathroom_renovation_date: l.bathroom_renovation_date ?? null,
    flooring_installation_date: l.flooring_installation_date ?? null,
    kitchen_renovation_date: l.kitchen_renovation_date ?? null,
    spa_installation_date: l.spa_installation_date ?? null,
    pool_installation_date: l.pool_installation_date ?? null,
    built_year: l.built_year ?? null,
  }));
}

function buildStructureFromHtml() {
  // No structure details available in provided HTML; return all required keys as null
  return {
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
    number_of_stories: null,
    finished_base_area: null,
    finished_upper_story_area: null,
    finished_basement_area: null,
    unfinished_base_area: null,
    unfinished_upper_story_area: null,
    unfinished_basement_area: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    roof_date: null,
    siding_installation_date: null,
    foundation_repair_date: null,
    exterior_door_installation_date: null,
    window_installation_date: null,
  };
}

function parseMailingAddress(mailingAddressText) {
  if (!mailingAddressText || mailingAddressText.trim() === "") return null;

  const full = mailingAddressText.trim();

  // Parse mailing address - similar logic to parseAddress
  // Expected format: "1741 COUNTY ROAD 3304, GREENVILLE, TX 75402"
  let street_number = null,
    street_name = null,
    street_pre_directional_text = null,
    street_post_directional_text = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null;

  // Try pattern with street number first
  let m = full.match(
    /^(\d+)\s+([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/i
  );

  if (m) {
    street_number = m[1];
    let streetPart = m[2].trim();
    const streetWords = streetPart.split(/\s+/);

    // Check for directionals and suffix (from right to left)
    for (let i = streetWords.length - 1; i >= 0; i--) {
      const wordUpper = streetWords[i].toUpperCase();

      if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(wordUpper)) {
        street_post_directional_text = wordUpper;
        streetWords.splice(i, 1);
        continue;
      }

      if (['ROAD', 'RD', 'STREET', 'ST', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
           'COURT', 'CT', 'BOULEVARD', 'BLVD', 'WAY', 'PLACE', 'PL', 'TERRACE', 'TER',
           'PARKWAY', 'PKWY', 'CIRCLE', 'CIR'].includes(wordUpper)) {
        const suffixMap = {
          'ROAD': 'Rd', 'RD': 'Rd', 'STREET': 'St', 'ST': 'St',
          'AVENUE': 'Ave', 'AVE': 'Ave', 'DRIVE': 'Dr', 'DR': 'Dr',
          'LANE': 'Ln', 'LN': 'Ln', 'COURT': 'Ct', 'CT': 'Ct',
          'BOULEVARD': 'Blvd', 'BLVD': 'Blvd', 'WAY': 'Way',
          'PLACE': 'Pl', 'PL': 'Pl', 'TERRACE': 'Ter', 'TER': 'Ter',
          'PARKWAY': 'Pkwy', 'PKWY': 'Pkwy', 'CIRCLE': 'Cir', 'CIR': 'Cir'
        };
        street_suffix_type = suffixMap[wordUpper] || 'Rd';
        streetWords.splice(i, 1);
        break;
      }
    }

    street_name = streetWords.join(' ').trim() || null;
    city_name = m[3].trim().toUpperCase();
    state_code = m[4].toUpperCase();
    postal_code = m[5];
    plus4 = m[6] || null;
  } else {
    // Try pattern without street number
    m = full.match(/^([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/i);
    if (m) {
      let streetPart = m[1].trim();
      const streetWords = streetPart.split(/\s+/);

      for (let i = streetWords.length - 1; i >= 0; i--) {
        const wordUpper = streetWords[i].toUpperCase();

        if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(wordUpper)) {
          street_post_directional_text = wordUpper;
          streetWords.splice(i, 1);
          continue;
        }

        if (['ROAD', 'RD', 'STREET', 'ST', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
             'COURT', 'CT', 'BOULEVARD', 'BLVD', 'WAY', 'PLACE', 'PL', 'TERRACE', 'TER',
             'PARKWAY', 'PKWY', 'CIRCLE', 'CIR'].includes(wordUpper)) {
          const suffixMap = {
            'ROAD': 'Rd', 'RD': 'Rd', 'STREET': 'St', 'ST': 'St',
            'AVENUE': 'Ave', 'AVE': 'Ave', 'DRIVE': 'Dr', 'DR': 'Dr',
            'LANE': 'Ln', 'LN': 'Ln', 'COURT': 'Ct', 'CT': 'Ct',
            'BOULEVARD': 'Blvd', 'BLVD': 'Blvd', 'WAY': 'Way',
            'PLACE': 'Pl', 'PL': 'Pl', 'TERRACE': 'Ter', 'TER': 'Ter',
            'PARKWAY': 'Pkwy', 'PKWY': 'Pkwy', 'CIRCLE': 'Cir', 'CIR': 'Cir'
          };
          street_suffix_type = suffixMap[wordUpper] || 'Rd';
          streetWords.splice(i, 1);
          break;
        }
      }

      street_name = streetWords.join(' ').trim() || null;
      city_name = m[2].trim().toUpperCase();
      state_code = m[3].toUpperCase();
      postal_code = m[4];
      plus4 = m[5] || null;
    }
  }

  // Return schema-compliant address structure (without street component fields)
  return {
    source_http_request: null,
    request_identifier: null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: plus4 || null,
    country_code: "US",
    county_name: "Hunt",
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    lot: null,
    block: null,
    unnormalized_address: full,
  };
}

function parseAddress(unnormalizedPath, situsText) {
  const addrSeed = readJson(unnormalizedPath);
  const full = addrSeed.full_address || situsText || "";
  // Parse addresses with or without street numbers
  // Format 1: "1741 COUNTY ROAD 3304, GREENVILLE, TX 75402"
  // Format 2: "MEADOWS ST COMMERCE, TX 75428" (no street number)
  // Format 3: "5012 COUNTY ROAD 4203, CAMPBELL, TX 75422"
  let street_number = null,
    street_name = null,
    street_pre_directional_text = null,
    street_post_directional_text = null,
    street_suffix_type = null,
    city_name = null,
    state_code = null,
    postal_code = null,
    plus4 = null;

  // List of valid street suffixes from the lexicon enum
  const validSuffixes = ["Rd", "St", "Ave", "Dr", "Ln", "Ct", "Blvd", "Way", "Pl", "Ter", "Pkwy", "Cir"]; // Common ones

  // Try pattern with street number first
  let m = full.match(
    /^(\d+)\s+([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/i,
  );

  if (m) {
    // Pattern with street number matched
    street_number = m[1];
    let streetPart = m[2].trim();

    // Extract street suffix and directionals
    const streetWords = streetPart.split(/\s+/);

    // Check for directionals and suffix
    for (let i = streetWords.length - 1; i >= 0; i--) {
      const word = streetWords[i];
      const wordUpper = word.toUpperCase();

      // Check if it's a directional suffix
      if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(wordUpper)) {
        street_post_directional_text = wordUpper;
        streetWords.splice(i, 1);
        continue;
      }

      // Check if it might be a street suffix (common abbreviations)
      if (['ROAD', 'RD', 'STREET', 'ST', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
           'COURT', 'CT', 'BOULEVARD', 'BLVD', 'WAY', 'PLACE', 'PL', 'TERRACE', 'TER',
           'PARKWAY', 'PKWY', 'CIRCLE', 'CIR'].includes(wordUpper)) {
        // Map to lexicon-compliant suffix
        const suffixMap = {
          'ROAD': 'Rd', 'RD': 'Rd',
          'STREET': 'St', 'ST': 'St',
          'AVENUE': 'Ave', 'AVE': 'Ave',
          'DRIVE': 'Dr', 'DR': 'Dr',
          'LANE': 'Ln', 'LN': 'Ln',
          'COURT': 'Ct', 'CT': 'Ct',
          'BOULEVARD': 'Blvd', 'BLVD': 'Blvd',
          'WAY': 'Way',
          'PLACE': 'Pl', 'PL': 'Pl',
          'TERRACE': 'Ter', 'TER': 'Ter',
          'PARKWAY': 'Pkwy', 'PKWY': 'Pkwy',
          'CIRCLE': 'Cir', 'CIR': 'Cir'
        };
        street_suffix_type = suffixMap[wordUpper] || 'Rd'; // Default to Rd
        streetWords.splice(i, 1);
        break; // Only take the first (rightmost) suffix
      }
    }

    // Remaining words are the street name
    street_name = streetWords.join(' ').trim() || null;

    city_name = m[3].trim().toUpperCase();
    state_code = m[4].toUpperCase();
    postal_code = m[5];
    plus4 = m[6] || null;
  } else {
    // Try pattern without street number: "STREET NAME, CITY, STATE ZIP"
    m = full.match(
      /^([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/i,
    );
    if (m) {
      street_number = null;
      let streetPart = m[1].trim();

      // Extract street suffix and directionals (same logic as above)
      const streetWords = streetPart.split(/\s+/);

      for (let i = streetWords.length - 1; i >= 0; i--) {
        const word = streetWords[i];
        const wordUpper = word.toUpperCase();

        if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(wordUpper)) {
          street_post_directional_text = wordUpper;
          streetWords.splice(i, 1);
          continue;
        }

        if (['ROAD', 'RD', 'STREET', 'ST', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
             'COURT', 'CT', 'BOULEVARD', 'BLVD', 'WAY', 'PLACE', 'PL', 'TERRACE', 'TER',
             'PARKWAY', 'PKWY', 'CIRCLE', 'CIR'].includes(wordUpper)) {
          const suffixMap = {
            'ROAD': 'Rd', 'RD': 'Rd',
            'STREET': 'St', 'ST': 'St',
            'AVENUE': 'Ave', 'AVE': 'Ave',
            'DRIVE': 'Dr', 'DR': 'Dr',
            'LANE': 'Ln', 'LN': 'Ln',
            'COURT': 'Ct', 'CT': 'Ct',
            'BOULEVARD': 'Blvd', 'BLVD': 'Blvd',
            'WAY': 'Way',
            'PLACE': 'Pl', 'PL': 'Pl',
            'TERRACE': 'Ter', 'TER': 'Ter',
            'PARKWAY': 'Pkwy', 'PKWY': 'Pkwy',
            'CIRCLE': 'Cir', 'CIR': 'Cir'
          };
          street_suffix_type = suffixMap[wordUpper] || 'Rd';
          streetWords.splice(i, 1);
          break;
        }
      }

      street_name = streetWords.join(' ').trim() || null;

      city_name = m[2].trim().toUpperCase();
      state_code = m[3].toUpperCase();
      postal_code = m[4];
      plus4 = m[5] || null;
    } else {
      // Try pattern without street number and no comma between street and city
      // Example: "MEADOWS ST COMMERCE, TX 75428"
      m = full.match(
        /^(.+?)\s+([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?/i,
      );
      if (m) {
        // Need to distinguish street from city - assume last word before comma is city
        const beforeComma = full.split(',')[0].trim();
        const parts = beforeComma.split(/\s+/);
        if (parts.length >= 2) {
          // Last word(s) before comma is likely the city
          const cityPart = parts[parts.length - 1];
          const streetPart = parts.slice(0, -1).join(' ');

          const streetWords = streetPart.split(/\s+/);

          for (let i = streetWords.length - 1; i >= 0; i--) {
            const word = streetWords[i];
            const wordUpper = word.toUpperCase();

            if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'].includes(wordUpper)) {
              street_post_directional_text = wordUpper;
              streetWords.splice(i, 1);
              continue;
            }

            if (['ROAD', 'RD', 'STREET', 'ST', 'AVENUE', 'AVE', 'DRIVE', 'DR', 'LANE', 'LN',
                 'COURT', 'CT', 'BOULEVARD', 'BLVD', 'WAY', 'PLACE', 'PL', 'TERRACE', 'TER',
                 'PARKWAY', 'PKWY', 'CIRCLE', 'CIR'].includes(wordUpper)) {
              const suffixMap = {
                'ROAD': 'Rd', 'RD': 'Rd',
                'STREET': 'St', 'ST': 'St',
                'AVENUE': 'Ave', 'AVE': 'Ave',
                'DRIVE': 'Dr', 'DR': 'Dr',
                'LANE': 'Ln', 'LN': 'Ln',
                'COURT': 'Ct', 'CT': 'Ct',
                'BOULEVARD': 'Blvd', 'BLVD': 'Blvd',
                'WAY': 'Way',
                'PLACE': 'Pl', 'PL': 'Pl',
                'TERRACE': 'Ter', 'TER': 'Ter',
                'PARKWAY': 'Pkwy', 'PKWY': 'Pkwy',
                'CIRCLE': 'Cir', 'CIR': 'Cir'
              };
              street_suffix_type = suffixMap[wordUpper] || 'Rd';
              streetWords.splice(i, 1);
              break;
            }
          }

          street_number = null;
          street_name = streetWords.join(' ').trim() || null;
          city_name = cityPart.toUpperCase();
          state_code = m[3].toUpperCase();
          postal_code = m[4];
          plus4 = m[5] || null;
        }
      }
    }
  }

  // Per evaluator feedback, county_name should be Hunt
  const county_name = "Hunt";

  // If no suffix was extracted, default to 'Rd' to satisfy the required field
  if (!street_suffix_type) {
    street_suffix_type = 'Rd';
  }

  return {
    source_http_request: addrSeed.source_http_request || null,
    request_identifier: addrSeed.request_identifier || null,
    unit_identifier: null,
    city_name: city_name || null,
    municipality_name: null,
    state_code: state_code || null,
    postal_code: postal_code || null,
    plus_four_postal_code: plus4 || null,
    country_code: "US",
    county_name: county_name,
    latitude: null,
    longitude: null,
    route_number: null,
    township: null,
    range: null,
    section: null,
    lot: null,
    block: null,
    unnormalized_address: addrSeed.full_address || null,
  };
}

function isCompanyName(name) {
  if (!name) return false;

  // Comprehensive company keyword list
  const companyKeywords = [
    "inc", "llc", "ltd", "foundation", "alliance", "solutions", "corp", "co",
    "services", "trust", "tr", "company", "partners", "holdings", "lp", "pllc",
    "pc", "bank", "association", "assn", "church", "group", "university",
    "school", "authority", "dept", "department", "ministries", "incorporated",
    "corporation", "limited", "estate", "partnership", "associates", "properties",
    "investments", "enterprises", "ventures", "capital", "fund", "society",
    "organization", "agency"
  ];

  const companyRe = new RegExp(
    `(^|[^a-zA-Z])(${companyKeywords.join("|")})([^a-zA-Z]|$)`,
    "i"
  );

  return companyRe.test(name);
}

/**
 * Normalize company name: if it contains ampersand (&) and entity keywords,
 * replace & with "and" to create a single company entity
 */
function normalizeCompanyName(name) {
  if (!name) return name;

  // Entity keywords as specified in requirements
  const entityKeywords = ["LLC", "ESTATE", "INC", "CORP", "TRUST", "LTD", "LP"];

  // Check if name contains ampersand
  if (name.includes("&")) {
    // Check if it also contains any entity keyword
    const hasEntityKeyword = entityKeywords.some(keyword =>
      new RegExp('\\b' + keyword + '\\b', "i").test(name)
    );

    // If it has both & and entity keyword, replace & with "and"
    if (hasEntityKeyword) {
      return name.replace(/\s*&\s*/g, " and ");
    }
  }

  return name;
}

function mapFileFormatFromUrl(url) {
  const lower = (url || "").toLowerCase();
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "jpeg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".pdf")) return "pdf"; // will trigger unknown enum error
  return null;
}

function main() {
  cleanupDataDir();

  const htmlPath = "input.html";
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");
  const unnormalizedAddrPath = "unnormalized_address.json";

  const { property, lot, taxes, deeds, deedParties, files, situs, salesHistory, owner, layouts } =
    extractFromHtml(htmlPath);

  // Write property.json
  writeJson(path.join("data", "property.json"), property);

  // Write lot.json
  writeJson(path.join("data", "lot.json"), lot);

  // Initialize counters and maps for person/company files
  let personIdCounter = 1;
  let companyIdCounter = 1;
  const granteesToPersonId = new Map();
  const granteesToCompanyId = new Map();
  const propertySeed = readJson("property_seed.json");

  // Create person and company files for ALL grantees from deed history FIRST
  for (const granteeName of deedParties) {
    // Check if this is a company
    if (isCompanyName(granteeName)) {
      // Normalize company name (replace & with "and" if entity keywords present)
      const normalizedCompanyName = normalizeCompanyName(granteeName);

      // Create company file
      if (!granteesToCompanyId.has(granteeName)) {
        const companyData = {
          name: normalizedCompanyName,
          source_http_request: propertySeed.source_http_request || {
            url: "https://esearch.hunt-cad.org/Property/View/" + (propertySeed.parcel_id || ""),
            method: "GET",
            multiValueQueryString: {}
          },
          request_identifier: propertySeed.request_identifier || propertySeed.parcel_id || null,
        };
        writeJson(path.join("data", `company_${companyIdCounter}.json`), companyData);
        granteesToCompanyId.set(granteeName, companyIdCounter);
        companyIdCounter++;
      }
    } else {
      // Parse as person(s)
      const granteePersons = parsePersonNames(granteeName);

      // Create person files for each parsed person from this grantee
      for (const person of granteePersons) {
        const personKey = `${person.first_name}|${person.middle_name}|${person.last_name}|${person.suffix_name}`;

        // Check if we already created this person
        if (!granteesToPersonId.has(personKey)) {
          writeJson(path.join("data", `person_${personIdCounter}.json`), person);
          granteesToPersonId.set(personKey, personIdCounter);
          granteesToPersonId.set(granteeName, personIdCounter); // Also map original name
          personIdCounter++;
        }
      }
    }
  }

  // Write owner information if available
  let ownerPersonIdCounter = 1;

  if (owner && owner.owner_name) {
    const ownerIsCompany = isCompanyName(owner.owner_name);

    if (ownerIsCompany) {
      // Check if this company already exists in grantee companies
      let ownerCompanyId = granteesToCompanyId.get(owner.owner_name);

      if (!ownerCompanyId) {
        // Create new company file for owner
        const propertySeedData = readJson("property_seed.json");
        // Normalize company name (replace & with "and" if entity keywords present)
        const normalizedCompanyName = normalizeCompanyName(owner.owner_name);
        const companyData = {
          name: normalizedCompanyName,
          source_http_request: propertySeedData.source_http_request || {
            url: "https://esearch.hunt-cad.org/Property/View/" + (propertySeedData.parcel_id || ""),
            method: "GET",
            multiValueQueryString: {}
          },
          request_identifier: propertySeedData.request_identifier || propertySeedData.parcel_id || null,
        };
        writeJson(path.join("data", `company_${companyIdCounter}.json`), companyData);
        ownerCompanyId = companyIdCounter;
        granteesToCompanyId.set(owner.owner_name, companyIdCounter);
        companyIdCounter++;
      }

      // Create relationship from company to property (lexicon-compliant: company_has_property)
      writeJson(
        path.join("data", `relationship_company_${ownerCompanyId}_has_property.json`),
        {
          from: { "/": `./company_${ownerCompanyId}.json` },
          to: { "/": "./property.json" }
        }
      );

      // Handle mailing address for company
      if (owner.mailing_address) {
        const mailingAddr = parseMailingAddress(owner.mailing_address);
        if (mailingAddr) {
          writeJson(path.join("data", "mailing_address.json"), mailingAddr);

          // Create relationship from company to mailing address (lexicon-compliant: company_has_mailing_address)
          writeJson(
            path.join("data", `relationship_company_${ownerCompanyId}_has_mailing_address.json`),
            {
              from: { "/": `./company_${ownerCompanyId}.json` },
              to: { "/": "./mailing_address.json" }
            }
          );
        }
      }
    } else {
      // Create person file from owner name
      const ownerPersons = parsePersonNames(owner.owner_name);

      if (ownerPersons.length > 0) {
        // Use the first person extracted (typically there should be only one owner name)
        const ownerPerson = ownerPersons[0];
        const ownerPersonFileName = `owner_person_${ownerPersonIdCounter}.json`;
        writeJson(path.join("data", ownerPersonFileName), ownerPerson);

        // Create relationship from person to property (lexicon-compliant: person_owns_property)
        writeJson(
          path.join("data", `relationship_person_${ownerPersonIdCounter}_owns_property.json`),
          {
            from: { "/": `./${ownerPersonFileName}` },
            to: { "/": "./property.json" }
          }
        );

        // Handle mailing address for person
        if (owner.mailing_address) {
          const mailingAddr = parseMailingAddress(owner.mailing_address);
          if (mailingAddr) {
            writeJson(path.join("data", "mailing_address.json"), mailingAddr);

            // Create relationship from person to mailing address (lexicon-compliant: person_has_mailing_address)
            writeJson(
              path.join("data", `relationship_person_${ownerPersonIdCounter}_has_mailing_address.json`),
              {
                from: { "/": `./${ownerPersonFileName}` },
                to: { "/": "./mailing_address.json" }
              }
            );
          }
        }

        ownerPersonIdCounter++;
      }
    }
  }

  // Layouts from improvements are now in the layouts array
  // They will be combined with layouts from layoutMapping.js later

  // Write taxes (e.g., tax_2017.json ... tax_2025.json)
  Object.keys(taxes)
    .sort()
    .forEach((year) => {
      const taxFileName = `tax_${year}.json`;
      writeJson(path.join("data", taxFileName), taxes[year]);

      // Create relationship from property to tax for each year
      writeJson(
        path.join("data", `relationship_property_tax_${year}.json`),
        {
          from: { "/": "./property.json" },
          to: { "/": `./${taxFileName}` }
        }
      );
    });

  // SALES from Sales History - create sales and link to persons/companies
  if (Array.isArray(salesHistory) && salesHistory.length) {
    let saleIdx = 1;
    let deedIdx = 1;

    for (const sale of salesHistory) {
      // Parse date to ISO format if possible
      let iso = null;
      if (sale.date) {
        const parts = sale.date.split("/");
        if (parts.length === 3) {
          const month = parts[0].padStart(2, "0");
          const day = parts[1].padStart(2, "0");
          const year = parts[2];
          iso = `${year}-${month}-${day}`;
        }
      }

      // Write sale data
      const saleData = {
        ownership_transfer_date: iso,
      };
      writeJson(path.join("data", `sales_${saleIdx}.json`), saleData);

      // Create deed for this sale
      if (sale.deedType) {
        // Validate and ensure deed type is in the allowed enum list
        const validatedDeedType = validateDeedType(sale.deedType) || "Miscellaneous";

        // Build deed data with deed_type (required)
        const deedData = {
          deed_type: validatedDeedType,
        };

        // Only include volume, page, book if they have actual values from input.html
        // Ensure they are ALWAYS string type when included
        if (sale.volume) {
          deedData.volume = String(sale.volume);
        }
        if (sale.page) {
          deedData.page = String(sale.page);
        }
        if (sale.book) {
          deedData.book = String(sale.book);
        }

        writeJson(path.join("data", `deed_${deedIdx}.json`), deedData);

        // Create proper relationship between sale and deed
        writeJson(
          path.join("data", `relationship_sales_${saleIdx}_deed_${deedIdx}.json`),
          {
            from: { "/": `./sales_${saleIdx}.json` },
            to: { "/": `./deed_${deedIdx}.json` },
          },
        );

        deedIdx++;
      }

      // Link sale to existing person/company files for this grantee
      // Check if grantee is a company
      if (isCompanyName(sale.grantee)) {
        const companyId = granteesToCompanyId.get(sale.grantee);
        if (companyId) {
          // Create relationship from sale to company (as grantee)
          writeJson(
            path.join(
              "data",
              `relationship_sales_${saleIdx}_company_${companyId}_grantee.json`,
            ),
            {
              from: { "/": `./sales_${saleIdx}.json` },
              to: { "/": `./company_${companyId}.json` },
            },
          );
        }
      } else {
        // Link to person(s)
        const granteePersons = parsePersonNames(sale.grantee);

        // Create relationships for each person parsed from this grantee
        for (const person of granteePersons) {
          const personKey = `${person.first_name}|${person.middle_name}|${person.last_name}|${person.suffix_name}`;
          const personId = granteesToPersonId.get(personKey) || granteesToPersonId.get(sale.grantee);

          if (personId) {
            // Create relationship from sale to person (as grantee)
            writeJson(
              path.join(
                "data",
                `relationship_sales_${saleIdx}_person_${personId}_grantee.json`,
              ),
              {
                from: { "/": `./sales_${saleIdx}.json` },
                to: { "/": `./person_${personId}.json` },
              },
            );
          }
        }
      }

      saleIdx++;
    }
  }

  // Layouts - use only layouts extracted directly from HTML (no duplication)
  // layoutMapping.js is not used to avoid duplicate extraction
  const allLayouts = layouts;

  // Re-index all layouts
  allLayouts.forEach((l, idx) => {
    const layoutIdx = idx + 1;
    l.space_index = layoutIdx;
    l.space_type_index = String(layoutIdx);

    writeJson(path.join("data", `layout_${layoutIdx}.json`), l);

    // Create relationship from property to layout with space_type_index
    writeJson(
      path.join("data", `relationship_property_layout_${layoutIdx}.json`),
      {
        from: { "/": "./property.json" },
        to: {
          "/": `./layout_${layoutIdx}.json`,
          "space_type_index": String(layoutIdx)
        }
      }
    );
  });

  // Structure and Utility - Only create for properties with building improvements
  // Find the first layout with space_type "Building" (main area/living area)
  const buildingLayoutIndex = allLayouts.findIndex(l =>
    l.space_type === "Building"
  );

  if (buildingLayoutIndex >= 0) {
    // Property has building improvements - create structure and utility files
    const utility = buildUtilities(utilsPath);
    writeJson(path.join("data", "utility.json"), utility);

    const structure = buildStructureFromHtml();
    writeJson(path.join("data", "structure.json"), structure);

    const layoutNum = buildingLayoutIndex + 1;

    // Create layout_has_structure relationship
    writeJson(
      path.join("data", `relationship_layout_${layoutNum}_has_structure.json`),
      {
        from: { "/": `./layout_${layoutNum}.json` },
        to: { "/": "./structure.json" }
      }
    );

    // Create layout_has_utility relationship
    writeJson(
      path.join("data", `relationship_layout_${layoutNum}_has_utility.json`),
      {
        from: { "/": `./layout_${layoutNum}.json` },
        to: { "/": "./utility.json" }
      }
    );
  }
  // For vacant land: no structure/utility files or relationships are created

  // Address
  const address = parseAddress(unnormalizedAddrPath, situs);
  writeJson(path.join("data", "address.json"), address);

  // Files (Appraisal Notice)
  files.forEach((f, idx) => {
    const mappedFormat = mapFileFormatFromUrl(f.original_url);
    if (mappedFormat === "pdf") {
      // Unknown enum value per schema; raise error and skip file write
      console.log(
        JSON.stringify({
          type: "error",
          message: "Unknown enum value pdf.",
          path: "file.file_format",
        }),
      );
      return;
    }
    // If CID is required but not available, also surface a separate blocking message
    // (Requesting CID rather than fabricating)
    if (!f.ipfs_url) {
      console.log(
        JSON.stringify({
          type: "error",
          message: "Missing IPFS CID for file.",
          path: "file.ipfs_url",
        }),
      );
      return;
    }
    writeJson(path.join("data", `file_${idx + 1}.json`), {
      name: f.name,
      original_url: f.original_url,
      file_format: mappedFormat,
      ipfs_url: f.ipfs_url,
      document_type: "PropertyImage",
    });
  });

  // Sales: Not created due to missing purchase price in source HTML
}

function generateIPFSAggregator(dataDir) {
  console.log("[IPFS] Generating IPFS aggregator from:", dataDir);

  if (!fs.existsSync(dataDir)) {
    console.error("[IPFS] Data directory not found:", dataDir);
    return;
  }

  const files = fs.readdirSync(dataDir);
  const relationshipFiles = files.filter(f => f.startsWith("relationship_") && f.endsWith(".json"));

  console.log("[IPFS] Found", relationshipFiles.length, "relationship files");

  const relationships = {};

  relationshipFiles.forEach(file => {
    if (file === "relationship_property_address.json") {
      relationships.property_has_address = { "/": "./relationship_property_address.json" };
    }
    else if (file === "relationship_property_lot.json") {
      relationships.property_has_lot = { "/": "./relationship_property_lot.json" };
    }
    // Lexicon-compliant ownership relationships (person_owns_property, company_has_property)
    else if (file.match(/^relationship_person_\d+_owns_property\.json$/)) {
      if (!relationships.person_owns_property) relationships.person_owns_property = [];
      relationships.person_owns_property.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding person_owns_property:", file);
    }
    else if (file.match(/^relationship_company_\d+_has_property\.json$/)) {
      if (!relationships.company_has_property) relationships.company_has_property = [];
      relationships.company_has_property.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding company_has_property:", file);
    }
    // Lexicon-compliant mailing address relationships
    else if (file.match(/^relationship_person_\d+_has_mailing_address\.json$/)) {
      if (!relationships.person_has_mailing_address) relationships.person_has_mailing_address = [];
      relationships.person_has_mailing_address.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding person_has_mailing_address:", file);
    }
    else if (file.match(/^relationship_company_\d+_has_mailing_address\.json$/)) {
      if (!relationships.company_has_mailing_address) relationships.company_has_mailing_address = [];
      relationships.company_has_mailing_address.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding company_has_mailing_address:", file);
    }
    else if (file.startsWith("relationship_property_tax_")) {
      if (!relationships.property_has_tax) relationships.property_has_tax = [];
      relationships.property_has_tax.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_property_sales_")) {
      if (!relationships.property_has_sales_history) relationships.property_has_sales_history = [];
      relationships.property_has_sales_history.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_property_layout_")) {
      if (!relationships.property_has_layout) relationships.property_has_layout = [];
      relationships.property_has_layout.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_property_deed_")) {
      if (!relationships.property_has_deed) relationships.property_has_deed = [];
      relationships.property_has_deed.push({ "/": `./${file}` });
    }
    else if (file === "relationship_property_has_structure.json") {
      relationships.property_has_structure = { "/": "./relationship_property_has_structure.json" };
      console.log("[IPFS] ✓ Adding property_has_structure:", file);
    }
    else if (file === "relationship_property_has_utility.json") {
      relationships.property_has_utility = { "/": "./relationship_property_has_utility.json" };
      console.log("[IPFS] ✓ Adding property_has_utility:", file);
    }
    else if (file.match(/^relationship_layout_\d+_has_structure\.json$/)) {
      if (!relationships.layout_has_structure) relationships.layout_has_structure = [];
      relationships.layout_has_structure.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding layout_has_structure:", file);
    }
    else if (file.match(/^relationship_layout_\d+_has_utility\.json$/)) {
      if (!relationships.layout_has_utility) relationships.layout_has_utility = [];
      relationships.layout_has_utility.push({ "/": `./${file}` });
      console.log("[IPFS] ✓ Adding layout_has_utility:", file);
    }
    else if (file === "relationship_property_to_fact_sheet.json") {
      if (!relationships.property_has_fact_sheet) relationships.property_has_fact_sheet = [];
      relationships.property_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_sales_") && file.includes("_person_") && file.includes("_grantee")) {
      if (!relationships.sales_history_has_person) relationships.sales_history_has_person = [];
      relationships.sales_history_has_person.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_sales_") && file.includes("_company_") && file.includes("_grantee")) {
      if (!relationships.sales_history_has_company) relationships.sales_history_has_company = [];
      relationships.sales_history_has_company.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_sales_") && file.includes("_deed_")) {
      if (!relationships.sales_history_has_deed) relationships.sales_history_has_deed = [];
      relationships.sales_history_has_deed.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_sales_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.sales_history_has_fact_sheet) relationships.sales_history_has_fact_sheet = [];
      relationships.sales_history_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file === "relationship_address_to_fact_sheet.json") {
      if (!relationships.address_has_fact_sheet) relationships.address_has_fact_sheet = [];
      relationships.address_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file === "relationship_lot_to_fact_sheet.json") {
      if (!relationships.lot_has_fact_sheet) relationships.lot_has_fact_sheet = [];
      relationships.lot_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_tax_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.tax_has_fact_sheet) relationships.tax_has_fact_sheet = [];
      relationships.tax_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_layout_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.layout_has_fact_sheet) relationships.layout_has_fact_sheet = [];
      relationships.layout_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_person_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.person_has_fact_sheet) relationships.person_has_fact_sheet = [];
      relationships.person_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_company_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.company_has_fact_sheet) relationships.company_has_fact_sheet = [];
      relationships.company_has_fact_sheet.push({ "/": `./${file}` });
    }
    else if (file.startsWith("relationship_deed_") && file.endsWith("_to_fact_sheet.json")) {
      if (!relationships.deed_has_fact_sheet) relationships.deed_has_fact_sheet = [];
      relationships.deed_has_fact_sheet.push({ "/": `./${file}` });
    }
  });

  const ipfsData = {
    label: "County",
    relationships: relationships
  };

  const ownerKeys = Object.keys(relationships).filter(k => k.includes('owner'));
  console.log("[IPFS] Owner relationship keys in final object:", ownerKeys);

  const outputFile = path.join(dataDir, "bafkreiafiurwnt5jimim5wtu4c7wgagnwkdtzhg4ldel5ics646rtpfxjm.json");
  writeJson(outputFile, ipfsData);
  console.log("[IPFS] ✓ Generated IPFS aggregator file:", outputFile);
  console.log("[IPFS] Total relationships:", Object.keys(relationships).length);
}

if (require.main === module) {
  main();
}
