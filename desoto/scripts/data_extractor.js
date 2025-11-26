// Data extraction script per evaluator instructions
// - Reads: input.html, unnormalized_address.json, property_seed.json
// - Owners from owners/owner_data.json
// - Utilities from owners/utilities_data.json
// - Layout from owners/layout_data.json
// - Sales/Tax/Deed from input.html
// - Writes outputs to ./data/

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseCurrencyToNumber(txt) {
  if (txt == null) return null;
  const s = String(txt).replace(/[$,\s]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseDateToISO(txt) {
  if (!txt) return null;
  const s = String(txt).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

const norm = (value) => (value || "").replace(/\s+/g, " ").trim();

function pruneNullish(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] === null || obj[key] === undefined) delete obj[key];
  });
  return obj;
}

function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  return /\b(inc|inc\.|corp|corp\.|co|co\.|ltd|ltd\.|llc|l\.l\.c\.|plc|plc\.|pc|p\.c\.|pllc|trust|tr|n\.?a\.?|bank|foundation|alliance|solutions|services|associates|association|holdings|partners|properties|enterprises|management|investments|group|development)\b\.?/.test(
    n,
  );
}

function normalizePersonKey(person) {
  const parts = [
    person.prefix_name ? person.prefix_name.toLowerCase() : "",
    person.first_name ? person.first_name.toLowerCase() : "",
    person.middle_name ? person.middle_name.toLowerCase() : "",
    person.last_name ? person.last_name.toLowerCase() : "",
    person.suffix_name ? person.suffix_name.toLowerCase() : "",
  ];
  return parts.join("|");
}

function normalizeCompanyKey(name) {
  return norm(name).toLowerCase();
}

function buildPersonFromSingleName(s) {
  const cleaned = norm(s);
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return [
      {
        type: "company",
        name: formatNameToPattern(cleaned),
      },
    ];
  }

  if (/,/.test(cleaned)) {
    const [last, rest] = cleaned.split(",", 2).map((x) => norm(x));
    const restParts = (rest || "").split(/\s+/).filter(Boolean);
    const first = restParts.shift() || "";
    const middle = restParts.length ? norm(restParts.join(" ")) : null;
    return [
      {
        type: "person",
        first_name: formatNameToPattern(first),
        last_name: formatNameToPattern(last),
        middle_name: middle ? formatNameToPattern(middle) : null,
      },
    ];
  }

  if (parts.length === 2) {
    const [part1, part2] = parts;
    if (part1 === part1.toUpperCase() && part2 === part2.toUpperCase()) {
      return [
        {
          type: "person",
          first_name: formatNameToPattern(part2),
          last_name: formatNameToPattern(part1),
          middle_name: null,
        },
      ];
    }
    return [
      {
        type: "person",
        first_name: formatNameToPattern(part1),
        last_name: formatNameToPattern(part2),
        middle_name: null,
      },
    ];
  }

  const first = parts[0];
  const last = parts[parts.length - 1];
  const middleParts = parts.slice(1, -1).filter(Boolean);
  const middle = middleParts.length ? norm(middleParts.join(" ")) : null;

  return [
    {
      type: "person",
      first_name: formatNameToPattern(first),
      last_name: formatNameToPattern(last),
      middle_name: middle ? formatNameToPattern(middle) : null,
    },
  ];
}

function buildEntitiesFromRaw(raw) {
  const all = [];
  const s = norm(raw);
  if (!s) return all;

  if (/^(c\/o|care of)\b/i.test(s)) return all;

  const segments = s
    .split(/\n|&|;/)
    .map((piece) => norm(piece))
    .filter(Boolean);

  segments.forEach((segment) => {
    if (isCompanyName(segment)) {
      all.push({ type: "company", name: formatNameToPattern(segment) });
    } else {
      all.push(...buildPersonFromSingleName(segment));
    }
  });
  return all;
}

function raiseEnumError(value, pathStr) {
  const err = {
    type: "error",
    message: `Unknown enum value ${value}.`,
    path: pathStr,
  };
  console.error(JSON.stringify(err));
}

function formatNameToPattern(name) {
  if (!name) return null;
  let cleaned = name.trim();

  // Replace forward slashes with hyphens to conform to the schema pattern
  // This is a logical replacement as '/' often implies a separation similar to '-'
  cleaned = cleaned.replace(/\//g, '-');

  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Split by spaces, hyphens, apostrophes, commas, periods, keeping the delimiters
  return cleaned.split(/([ \-',.])/)
    .map((part) => {
      if (!part) return ''; // Handle empty parts from splitting
      if (part.match(/[ \-',.]/)) { // If it's a delimiter, return it as is
        return part;
      }
      // For actual name parts, capitalize the first letter and lowercase the rest
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}


function mapPrefixName(name) {
  const prefixes = {
    'MR': 'Mr.', 'MRS': 'Mrs.', 'MS': 'Ms.', 'MISS': 'Miss', 'MX': 'Mx.',
    'DR': 'Dr.', 'PROF': 'Prof.', 'REV': 'Rev.', 'FR': 'Fr.', 'SR': 'Sr.',
    'BR': 'Br.', 'CAPT': 'Capt.', 'COL': 'Col.', 'MAJ': 'Maj.', 'LT': 'Lt.',
    'SGT': 'Sgt.', 'HON': 'Hon.', 'JUDGE': 'Judge', 'RABBI': 'Rabbi',
    'IMAM': 'Imam', 'SHEIKH': 'Sheikh', 'SIR': 'Sir', 'DAME': 'Dame'
  };
  return prefixes[name?.toUpperCase()] || null;
}

function mapSuffixName(name) {
  const suffixes = {
    'JR': 'Jr.', 'SR': 'Sr.', 'II': 'II', 'III': 'III', 'IV': 'IV',
    'PHD': 'PhD', 'MD': 'MD', 'ESQ': 'Esq.', 'JD': 'JD', 'LLM': 'LLM',
    'MBA': 'MBA', 'RN': 'RN', 'DDS': 'DDS', 'DVM': 'DVM', 'CFA': 'CFA',
    'CPA': 'CPA', 'PE': 'PE', 'PMP': 'PMP', 'EMERITUS': 'Emeritus', 'RET': 'Ret.'
  };
  return suffixes[name?.toUpperCase()] || null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const ownerDataPath = path.join("owners", "owner_data.json");
  const utilitiesDataPath = path.join("owners", "utilities_data.json");
const layoutDataPath = path.join("owners", "layout_data.json");
const structureDataPath = path.join("owners", "structure_data.json");

  const ownerData = fs.existsSync(ownerDataPath)
    ? readJson(ownerDataPath)
    : null;
  const utilitiesData = fs.existsSync(utilitiesDataPath)
    ? readJson(utilitiesDataPath)
    : null;
const layoutData = fs.existsSync(layoutDataPath)
  ? readJson(layoutDataPath)
  : null;
const structureData = fs.existsSync(structureDataPath)
  ? readJson(structureDataPath)
  : null;

  const propertySeed = fs.existsSync("property_seed.json")
    ? readJson("property_seed.json")
    : null;
  const unnormalizedAddress = fs.existsSync("unnormalized_address.json")
    ? readJson("unnormalized_address.json")
    : null;

  // Determine hyphenated parcel id from HTML
  let hyphenParcel = null;
  // Updated selector for parcel ID
  const parcelText = $("table.parcelIDtable b").first().text().trim();
  const mParcel = parcelText.match(/^([^\s(]+)/); // Matches "23-4S-16-03099-117 (14877)"
  if (mParcel) hyphenParcel = mParcel[1];
  if (!hyphenParcel) {
    const fmt = $('input[name="formatPIN"]').attr("value");
    if (fmt) hyphenParcel = fmt.trim();
  }

  let personIndex = 0;
  let companyIndex = 0;
  const ownerPersonFiles = [];
  const ownerCompanyFiles = [];
  const personRegistry = new Map();
  const companyRegistry = new Map();
  let utilityFilePath = null;
  let structureFilePath = null;
  const propertyRelationshipQueue = [];

  function ensurePersonFile(personPayload) {
    const key = normalizePersonKey(personPayload);
    if (personRegistry.has(key)) return personRegistry.get(key);

    personIndex += 1;
    const relPath = `./person_${personIndex}.json`;
    const record = {
      source_http_request: {
        method: "GET",
        url:
          propertySeed?.source_http_request?.url ||
          unnormalizedAddress?.source_http_request?.url ||
          "https://www.desotopa.com/gis",
      },
      request_identifier: hyphenParcel,
      birth_date: null,
      first_name: formatNameToPattern(personPayload.first_name),
      last_name: formatNameToPattern(personPayload.last_name),
      middle_name: personPayload.middle_name
        ? formatNameToPattern(personPayload.middle_name)
        : null,
      prefix_name: personPayload.prefix_name
        ? mapPrefixName(personPayload.prefix_name)
        : null,
      suffix_name: personPayload.suffix_name
        ? mapSuffixName(personPayload.suffix_name)
        : null,
      us_citizenship_status: null,
      veteran_status: null,
    };
    writeJson(path.join("data", `person_${personIndex}.json`), record);
    personRegistry.set(key, relPath);
    return relPath;
  }

  function ensureCompanyFile(companyPayload) {
    const key = normalizeCompanyKey(companyPayload.name);
    if (companyRegistry.has(key)) return companyRegistry.get(key);

    companyIndex += 1;
    const relPath = `./company_${companyIndex}.json`;
    writeJson(path.join("data", `company_${companyIndex}.json`), {
      name: companyPayload.name ? formatNameToPattern(companyPayload.name) : null,
    });
    companyRegistry.set(key, relPath);
    return relPath;
  }

  function relationshipFileName(fromPath, toPath) {
    const fromBase = path.basename(fromPath, ".json");
    const toBase = path.basename(toPath, ".json");
    return `relationship_${fromBase}_has_${toBase}.json`;
  }

  // 1) OWNERS
  if (ownerData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const ownersScope = key && ownerData[key] ? ownerData[key] : null;
    if (
      ownersScope &&
      ownersScope.owners_by_date &&
      Array.isArray(ownersScope.owners_by_date.current)
    ) {
      const currentOwners = ownersScope.owners_by_date.current;
      for (const ow of currentOwners) {
        if (ow.type === "company") {
          const relPath = ensureCompanyFile({ name: ow.name || null });
          if (relPath) ownerCompanyFiles.push(relPath);
        } else if (ow.type === "person") {
          const relPath = ensurePersonFile({
            first_name: ow.first_name,
            middle_name: ow.middle_name || null,
            last_name: ow.last_name,
            prefix_name: ow.prefix_name || null,
            suffix_name: ow.suffix_name || null,
          });
          if (relPath) ownerPersonFiles.push(relPath);
        }
      }
    }
  }
  globalThis.__ownerCompanyFiles = ownerCompanyFiles;
  globalThis.__ownerPersonFiles = ownerPersonFiles;

  // 1b) MAILING ADDRESS
  // Pull mailing address lines from the Owner block, omitting the bolded owner names.
  function extractMailingAddressLines($root) {
    let lines = null;
    $root("table.parcelDetails_insideTable tr").each((_, tr) => {
      const tds = $root(tr).find("td");
      if (tds.length >= 2) {
        const label = $root(tds[0]).text().trim();
        if (/^Owner$/i.test(label)) {
          const cellHtml = $root(tds[1]).html() || "";
          const htmlWithoutBold = cellHtml.replace(/<\s*\/?b[^>]*>/gi, "");
          const parts = htmlWithoutBold
            .split(/<br\s*\/?>/i)
            .map((segment) => segment.replace(/<[^>]+>/g, ""))
            .map((segment) => segment.replace(/\s+/g, " ").trim())
            .filter(Boolean);
          if (parts.length) {
            // Remove leading owner name(s) if present (bold text originally)
            const candidateLines = [];
            parts.forEach((part, idx) => {
              if (idx === 0) {
                const looksLikeAddress =
                  /^(\d+\s+.+)/.test(part) ||
                  /^P\.?O\.?\s*BOX/i.test(part) ||
                  /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?$/.test(part);
                if (looksLikeAddress) candidateLines.push(part);
              } else {
                candidateLines.push(part);
              }
            });
            lines =
              candidateLines.length
                ? candidateLines
                : parts.length > 1
                  ? parts.slice(1)
                  : parts;
          }
          return false;
        }
      }
      return true;
    });
    return lines;
  }

  const mailingAddressLines = extractMailingAddressLines($);
  if (mailingAddressLines && mailingAddressLines.length) {
    const unnormalizedMailingAddress = mailingAddressLines.join(", ");
    const defaultSource =
      propertySeed?.source_http_request ||
      unnormalizedAddress?.source_http_request || {
        method: "GET",
        url:
          propertySeed?.source_http_request?.url ||
          unnormalizedAddress?.source_http_request?.url ||
          "https://www.desotopa.com/gis",
        multiValueQueryString: {},
      };
    const mailingAddress = {
      source_http_request: defaultSource,
      request_identifier:
        propertySeed?.request_identifier ||
        unnormalizedAddress?.request_identifier ||
        hyphenParcel ||
        propertySeed?.parcel_id ||
        null,
      unnormalized_address: unnormalizedMailingAddress,
      latitude: null,
      longitude: null,
    };
    writeJson(path.join("data", "mailing_address.json"), mailingAddress);

    const mailingPath = "./mailing_address.json";

    ownerCompanyFiles.forEach((companyPath) => {
      const relName = relationshipFileName(companyPath, mailingPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": companyPath },
          to: { "/": mailingPath },
        },
      );
    });

    ownerPersonFiles.forEach((personPath) => {
      const relName = relationshipFileName(personPath, mailingPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": personPath },
          to: { "/": mailingPath },
        },
      );
    });
  }

  // 2) UTILITIES
  if (utilitiesData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const utilScope = key && utilitiesData[key] ? utilitiesData[key] : null;
    if (utilScope) {
      writeJson(path.join("data", "utility.json"), { ...utilScope });
      utilityFilePath = "./utility.json";
    }
  }

  // 2a) STRUCTURE
  if (structureData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const structScope = key && structureData[key] ? structureData[key] : null;
    if (structScope) {
      writeJson(path.join("data", "structure.json"), { ...structScope });
      structureFilePath = "./structure.json";
    }
  }

  // 3) LAYOUT
  if (layoutData) {
    const key = hyphenParcel ? `property_${hyphenParcel}` : null;
    const layScope = key && layoutData[key] ? layoutData[key] : null;
    if (layScope && Array.isArray(layScope.layouts)) {
      let i = 0;
      const layoutFiles = [];
      const buildingLayoutFiles = [];
      const nonBuildingLayoutFiles = [];
      for (const layout of layScope.layouts) {
        i += 1;
        const layoutRecord = { ...layout };
        if (layoutRecord.space_type_index != null) {
          layoutRecord.space_type_index = String(layoutRecord.space_type_index);
        } else {
          layoutRecord.space_type_index = String(i);
        }
        const fileName = `layout_${i}.json`;
        const relPath = `./${fileName}`;
        writeJson(path.join("data", fileName), layoutRecord);
        layoutFiles.push(relPath);
        if ((layoutRecord.space_type || "").toLowerCase() === "building") {
          buildingLayoutFiles.push(relPath);
        } else {
          nonBuildingLayoutFiles.push(relPath);
        }
      }

      const buildingCount = buildingLayoutFiles.length;

      if (buildingCount === 1) {
        const buildingPath = buildingLayoutFiles[0];
        nonBuildingLayoutFiles.forEach((otherPath) => {
          const relName = relationshipFileName(buildingPath, otherPath);
          writeJson(
            path.join("data", relName),
            {
              from: { "/": buildingPath },
              to: { "/": otherPath },
            },
          );
        });
        if (structureFilePath) {
          const relName = relationshipFileName(buildingPath, structureFilePath);
          writeJson(
            path.join("data", relName),
            {
              from: { "/": buildingPath },
              to: { "/": structureFilePath },
            },
          );
        }
        if (utilityFilePath) {
          const relName = relationshipFileName(buildingPath, utilityFilePath);
          writeJson(
            path.join("data", relName),
            {
              from: { "/": buildingPath },
              to: { "/": utilityFilePath },
            },
          );
        }
      } else {
        if (structureFilePath) {
          propertyRelationshipQueue.push(["./property.json", structureFilePath]);
        }
        if (utilityFilePath) {
          propertyRelationshipQueue.push(["./property.json", utilityFilePath]);
        }
      }
    } else {
      if (structureFilePath) {
        propertyRelationshipQueue.push(["./property.json", structureFilePath]);
      }
      if (utilityFilePath) {
        propertyRelationshipQueue.push(["./property.json", utilityFilePath]);
      }
    }
  } else {
    if (structureFilePath) {
      propertyRelationshipQueue.push(["./property.json", structureFilePath]);
    }
    if (utilityFilePath) {
      propertyRelationshipQueue.push(["./property.json", utilityFilePath]);
    }
  }

  // 4) SALES HISTORY, DEEDS, AND FILES
  function extractPartySegment(text, label) {
    const split = text.split(new RegExp(`${label}\\s*:`, "i"));
    if (split.length < 2) return null;
    const remainder = split[1];
    const nextLabelMatch = remainder.match(/\b(Grantor|Grantee|Buyer|Seller)\b\s*:/i);
    const segment = nextLabelMatch
      ? remainder.slice(0, nextLabelMatch.index)
      : remainder;
    return norm(segment);
  }

  function extractSaleParties($root, rowEl) {
    const grantors = new Set();
    const grantees = new Set();
    const buyers = new Set();

    const $row = $root(rowEl);
    const attrGrantor =
      $row.attr("data-grantor") ||
      $row.find("[data-grantor]").first().attr("data-grantor") ||
      null;
    const attrGrantee =
      $row.attr("data-grantee") ||
      $row.find("[data-grantee]").first().attr("data-grantee") ||
      null;

    if (attrGrantor) grantors.add(norm(attrGrantor));
    if (attrGrantee) grantees.add(norm(attrGrantee));

    const nextTr = $row.next("tr");
    if (nextTr.length === 1 && nextTr.find("td").length === 1) {
      const detailText = norm(nextTr.text());
      const grantorText = extractPartySegment(detailText, "Grantor");
      const granteeText = extractPartySegment(detailText, "Grantee");
      const buyerText = extractPartySegment(detailText, "Buyer");
      if (grantorText) grantors.add(grantorText);
      if (granteeText) grantees.add(granteeText);
      if (buyerText) buyers.add(buyerText);
    }

    return {
      grantors: Array.from(grantors).filter(Boolean),
      grantees: Array.from(grantees).filter(Boolean),
      buyers: Array.from(buyers).filter(Boolean),
    };
  }

  const salesRows = [];
  $("#parcelDetails_SalesTable table.parcelDetails_insideTable tr").each(
    (idx, el) => {
      if (idx === 0) return;
      const tds = $(el).find("td");
      if (tds.length >= 4) {
        const dateTxt = $(tds[0]).text().trim();
        if (!dateTxt || !/\d/.test(dateTxt)) return;
        const priceTxt = $(tds[1]).text().trim();
        const deedCode = $(tds[3]).text().trim();
        const bookCell = $(tds[2]);
        const bookPageTxt = bookCell.text().trim();
        const linkEl = bookCell.find("a");
        const js = (linkEl.attr("onclick") || linkEl.attr("href") || "").trim();
        const m1 = js.match(/ClerkLink\('([^']+)'\s*,\s*'([^']+)'\)/);
        const instrumentFromLink = m1 ? norm(m1[1]) : null;
        const pageFromLink = m1 && m1[2] ? norm(m1[2]) : null;
        const parties = extractSaleParties($, el);
        salesRows.push({
          dateTxt,
          priceTxt,
          deedCode,
          bookPageTxt,
          instrumentFromLink,
          pageFromLink,
          parties,
          qualificationCode: $(tds[5]) ? $(tds[5]).text().trim() : null,
        });
      }
    },
  );

  const deedCodeMap = {
    WD: "Warranty Deed",
    WTY: "Warranty Deed",
    SWD: "Special Warranty Deed",
    SW: "Special Warranty Deed",
    "Spec WD": "Special Warranty Deed",
    QCD: "Quitclaim Deed",
    QC: "Quitclaim Deed",
    Quitclaim: "Quitclaim Deed",
    GD: "Grant Deed",
    BSD: "Bargain and Sale Deed",
    LBD: "Lady Bird Deed",
    TOD: "Transfer on Death Deed",
    TODD: "Transfer on Death Deed",
    SD: "Sheriff's Deed",
    "Shrf's Deed": "Sheriff's Deed",
    TD: "Tax Deed",
    TrD: "Trustee's Deed",
    "Trustee Deed": "Trustee's Deed",
    PRD: "Personal Representative Deed",
    "Pers Rep Deed": "Personal Representative Deed",
    CD: "Correction Deed",
    "Corr Deed": "Correction Deed",
    DIL: "Deed in Lieu of Foreclosure",
    DILF: "Deed in Lieu of Foreclosure",
    LED: "Life Estate Deed",
    JTD: "Joint Tenancy Deed",
    TIC: "Tenancy in Common Deed",
    CPD: "Community Property Deed",
    "Gift Deed": "Gift Deed",
    ITD: "Interspousal Transfer Deed",
    "Wild D": "Wild Deed",
    SMD: "Special Master\u2019s Deed",
    COD: "Court Order Deed",
    CFD: "Contract for Deed",
    QTD: "Quiet Title Deed",
    AD: "Administrator's Deed",
    "GD (Guardian)": "Guardian's Deed",
    RD: "Receiver's Deed",
    ROW: "Right of Way Deed",
    VPD: "Vacation of Plat Deed",
    AOC: "Assignment of Contract",
    ROC: "Release of Contract",
    ASSG: "Assignment of Contract",
    PR: "Assignment of Contract",
  };

  const fileDocTypeMap = {
    WD: "Title",
    WTY: "Title",
    SWD: "Title",
    SW: "Title",
    "Spec WD": "Title",
    QCD: "Title",
    QC: "Title",
    Quitclaim: "Title",
    GD: "Title",
    BSD: "Title",
    LBD: "Title",
    TOD: "Title",
    TODD: "Title",
    SD: "Title",
    "Shrf's Deed": "Title",
    TD: "Title",
    TrD: "Title",
    "Trustee Deed": "Title",
    PRD: "Title",
    "Pers Rep Deed": "Title",
    CD: "Title",
    "Corr Deed": "Title",
    DIL: "Title",
    DILF: "Title",
    LED: "Title",
    JTD: "Title",
    TIC: "Title",
    CPD: "Title",
    "Gift Deed": "Title",
    ITD: "Title",
    "Wild D": "Title",
    SMD: "Title",
    COD: "Title",
    CFD: "Title",
    QTD: "Title",
    AD: "Title",
    "GD (Guardian)": "Title",
    RD: "Title",
    ROW: "Title",
    VPD: "Title",
    AOC: "Assignment",
    ROC: "Assignment",
    ASSG: "Assignment",
    JUDG: "AbstractOfJudgment",
  };

  const qualificationToSaleType = {
    Q: "TypicallyMotivated",
  };

  const saleHistoryFiles = [];
  let saleIndex = 0;
  let deedIndex = 0;
  let fileIndex = 0;

  for (const row of salesRows) {
    saleIndex += 1;
    const saleRelPath = `./sales_history_${saleIndex}.json`;
    const saleRecord = pruneNullish({
      source_http_request:
        propertySeed?.source_http_request ||
        unnormalizedAddress?.source_http_request || {
          method: "GET",
          url:
            propertySeed?.source_http_request?.url ||
            unnormalizedAddress?.source_http_request?.url ||
            "https://www.desotopa.com/gis",
        },
      request_identifier: hyphenParcel,
      ownership_transfer_date: parseDateToISO(row.dateTxt),
      purchase_price_amount: parseCurrencyToNumber(row.priceTxt),
      sale_type: row.qualificationCode
        ? qualificationToSaleType[row.qualificationCode.replace(/\s+/g, "")]
          || null
        : null,
    });

    writeJson(path.join("data", `sales_history_${saleIndex}.json`), saleRecord);
    saleHistoryFiles.push(saleRelPath);

    deedIndex += 1;
    const bookPageParts = row.bookPageTxt.includes("/")
      ? row.bookPageTxt.split("/")
      : null;
    const bookFromText =
      bookPageParts && bookPageParts[0] ? norm(bookPageParts[0]) : null;
    const pageFromText =
      bookPageParts && bookPageParts[1] ? norm(bookPageParts[1]) : null;

    const deedType =
      deedCodeMap[row.deedCode] ||
      (row.deedCode ? "Miscellaneous" : "Miscellaneous");
    const deedRecord = pruneNullish({
      source_http_request:
        propertySeed?.source_http_request ||
        unnormalizedAddress?.source_http_request || {
          method: "GET",
          url:
            propertySeed?.source_http_request?.url ||
            unnormalizedAddress?.source_http_request?.url ||
            "https://www.desotopa.com/gis",
        },
      request_identifier: hyphenParcel,
      deed_type: deedType,
      book: bookFromText || null,
      page: pageFromText || row.pageFromLink || null,
      volume: null,
      instrument_number: row.instrumentFromLink || (/\d{6,}/.test(row.bookPageTxt) ? row.bookPageTxt : null),
    });
    writeJson(path.join("data", `deed_${deedIndex}.json`), deedRecord);

    writeJson(
      path.join("data", relationshipFileName(saleRelPath, `./deed_${deedIndex}.json`)),
      {
        from: { "/": saleRelPath },
        to: { "/": `./deed_${deedIndex}.json` },
      },
    );

    fileIndex += 1;
    const fileRecord = {
      document_type: fileDocTypeMap[row.deedCode] || null,
      file_format: null,
      name: row.bookPageTxt ? `Official Records ${row.bookPageTxt}` : null,
      original_url: null,
      ipfs_url: null,
      request_identifier: hyphenParcel,
      source_http_request:
        propertySeed?.source_http_request ||
        unnormalizedAddress?.source_http_request || {
          method: "GET",
          url:
            propertySeed?.source_http_request?.url ||
            unnormalizedAddress?.source_http_request?.url ||
            "https://www.desotopa.com/gis",
        },
    };
    writeJson(path.join("data", `file_${fileIndex}.json`), fileRecord);

    writeJson(
      path.join(
        "data",
        relationshipFileName(`./deed_${deedIndex}.json`, `./file_${fileIndex}.json`),
      ),
      {
        from: { "/": `./deed_${deedIndex}.json` },
        to: { "/": `./file_${fileIndex}.json` },
      },
    );

    const grantorPersonPaths = [];
    const grantorCompanyPaths = [];
    const partySources = [
      ...(row.parties?.grantors || []),
      ...(row.parties?.buyers || []),
    ];
    partySources.forEach((rawParty) => {
      const entities = buildEntitiesFromRaw(rawParty);
      entities.forEach((entity) => {
        if (entity.type === "person") {
          const relPath = ensurePersonFile(entity);
          if (relPath && !grantorPersonPaths.includes(relPath)) {
            grantorPersonPaths.push(relPath);
          }
        } else if (entity.type === "company") {
          const relPath = ensureCompanyFile(entity);
          if (relPath && !grantorCompanyPaths.includes(relPath)) {
            grantorCompanyPaths.push(relPath);
          }
        }
      });
    });

    grantorCompanyPaths.forEach((companyPath) => {
      const relName = relationshipFileName(saleRelPath, companyPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": saleRelPath },
          to: { "/": companyPath },
        },
      );
    });

    grantorPersonPaths.forEach((personPath) => {
      const relName = relationshipFileName(saleRelPath, personPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": saleRelPath },
          to: { "/": personPath },
        },
      );
    });
  }

  if (saleHistoryFiles.length > 0) {
    const mostRecentSale = saleHistoryFiles[0];
    ownerCompanyFiles.forEach((companyPath) => {
      const relName = relationshipFileName(mostRecentSale, companyPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": mostRecentSale },
          to: { "/": companyPath },
        },
      );
    });

    ownerPersonFiles.forEach((personPath) => {
      const relName = relationshipFileName(mostRecentSale, personPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": mostRecentSale },
          to: { "/": personPath },
        },
      );
    });
  }

  // 5) TAX
  function buildTaxRecord($table, taxYear) {
    const findCell = (labelStartsWith) => {
      let cell = null;
      $table.find("tr").each((i, el) => {
        const $tds = $(el).find("td");
        if ($tds.length >= 2) {
          const labelText = $tds.eq(0).text().replace(/\s+/g, " ").trim();
          if (labelText.toLowerCase().startsWith(labelStartsWith.toLowerCase())) {
            cell = $tds.eq(1);
            return false;
          }
        }
        return true;
      });
      return cell;
    };

    const landCell = findCell("Mkt Land");
    const buildingCell = findCell("Building");
    const justCell = findCell("Just");
    const assessedCell = findCell("Assessed");
    const taxableCell = findCell("Total");

    if (!landCell || !buildingCell || !justCell || !assessedCell || !taxableCell) {
      return null;
    }

    const extractCurrency = (cell) => {
      const html = cell.html() || "";
      const matchHtml = html.match(/\$[0-9,.,]+/);
      if (matchHtml) return matchHtml[0];
      const text = cell.text();
      const matchText = text.match(/\$[0-9,.,]+/);
      return matchText ? matchText[0] : null;
    };

    const taxableValue = extractCurrency(taxableCell);
    if (!taxableValue) return null;

    return {
      tax_year: taxYear,
      property_land_amount: parseCurrencyToNumber(landCell.text().trim()),
      property_building_amount: parseCurrencyToNumber(buildingCell.text().trim()),
      property_market_value_amount: parseCurrencyToNumber(justCell.text().trim()),
      property_assessed_value_amount: parseCurrencyToNumber(assessedCell.text().trim()),
      property_taxable_value_amount: parseCurrencyToNumber(taxableValue),
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      first_year_building_on_tax_roll: null,
      first_year_on_tax_roll: null,
      yearly_tax_amount: null,
    };
  }

  const taxRecords = [];
  $("table.parcelDetails_insideTable").each((i, el) => {
    const headerText = $(el).find("tr").first().text().replace(/\s+/g, " ").trim();
    const match = headerText.match(/(\d{4})\s+(Preliminary|Certified)\s+Values/i);
    if (match) {
      const year = parseInt(match[1], 10);
      const record = buildTaxRecord($(el), year);
      if (record) taxRecords.push(record);
    }
  });

  taxRecords.forEach((record) => {
    writeJson(path.join("data", `tax_${record.tax_year}.json`), record);
  });

  // 6) PROPERTY
  const parcelIdentifier =
    propertySeed && propertySeed.parcel_id
      ? propertySeed.parcel_id
      : hyphenParcel || null; // Use hyphenParcel if propertySeed is not available

  // Clean full legal text without UI anchor artifacts
  let legal = null;
  // Updated selectors for legal description
  if ($("#Flegal").length) {
    const f = $("#Flegal").clone();
    f.find("a").remove();
    legal = f.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
  } else if ($("#Blegal").length) {
    const b = $("#Blegal").clone();
    b.find("a").remove();
    legal = b.text().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim() || null;
  }

  // livable and effective year
  let livable = null,
    effYear = null;
  // Updated selector for building table
  const bldgTable = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable",
  ).first();
  if (bldgTable && bldgTable.length) {
    const firstRow = bldgTable.find("tr").eq(1); // Assuming the first data row is the main building
    const tds = firstRow.find("td");
    if (tds.length >= 6) {
      const actualSF = tds.eq(4).text().trim(); // Actual SF is at index 4
      if (actualSF && actualSF !== "N O N E") livable = actualSF;
      const y = tds.eq(2).text().trim(); // Year Blt is at index 2
      if (/^\d{4}$/.test(y)) effYear = parseInt(y, 10);
    }
  }

  // Extract Area and convert to square feet
  let totalAreaSqft = null;
  // Updated selector for Land Area
  const landAreaTd = $('td:contains("Area")').first();
  if (landAreaTd.length) {
    const areaText = landAreaTd.next('td').text().trim();
    const acreMatch = areaText.match(/([0-9.]+)\s*AC/i);
    if (acreMatch) {
      const acres = parseFloat(acreMatch[1]);
      totalAreaSqft = Math.round(acres * 43560).toString(); // 1 acre = 43,560 sq ft
    }
  }


  // Extract Use Code and map to property_type
  // Updated selector for Use Code
  const useCodeVal = $('td')
    .filter((i, el) => $(el).text().trim().startsWith('Use'))
    .next()
    .text()
    .trim();

  const propertyTypeMapping = [
    {
      "desoto_property_type": "0000 - Vacant Residential",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "0004 - Vacant Condo",
      "ownership_estate_type": "Condominium",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "0100 - Single Family",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "SingleFamilyDetached",
      "property_usage_type": "Residential",
      "property_type": "SingleFamily"
    },
    {
      "desoto_property_type": "0107 - Townhomes",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "TownhouseRowhouse",
      "property_usage_type": "Residential",
      "property_type": "Townhouse"
    },
    {
      "desoto_property_type": "0200 - Mobile Homes",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MobileHome",
      "property_usage_type": "Residential",
      "property_type": "MobileHome"
    },
    {
      "desoto_property_type": "0300 - Multi-Family(10 or more Units)",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamily5Plus",
      "property_usage_type": "Residential",
      "property_type": "MultiFamilyMoreThan10"
    },
    {
      "desoto_property_type": "0400 - Condominium",
      "ownership_estate_type": "Condominium",
      "build_status": "Improved",
      "structure_form": "ApartmentUnit",
      "property_usage_type": "Residential",
      "property_type": "Condominium"
    },
    {
      "desoto_property_type": "0600 - Retirement Homes Not Eligible",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Retirement",
      "property_type": "Retirement"
    },
    {
      "desoto_property_type": "0700 - Miscellaneous Residential",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Residential",
      "property_type": "MiscellaneousResidential"
    },
    {
      "desoto_property_type": "0800 - Multi-Family(Less than 10 Units)",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamilyLessThan10",
      "property_usage_type": "Residential",
      "property_type": "MultiFamilyLessThan10"
    },
    {
      "desoto_property_type": "0805 - MFR < 10 Units - Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": "MultiFamilyLessThan10",
      "property_usage_type": "Commercial",
      "property_type": "MultiFamilyLessThan10"
    },
    {
      "desoto_property_type": "0900 - Residential Common Elements/Areas",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ResidentialCommonElementsAreas",
      "property_type": "ResidentialCommonElementsAreas"
    },
    {
      "desoto_property_type": "1000 - Vacant Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "1100 - Stores, One Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "RetailStore",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1200 - Mixed Use, Store/Office/Resi",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1300 - Department Store",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "DepartmentStore",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1400 - Supermarkets",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Supermarket",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1500 - Regional Shopping Centers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ShoppingCenterRegional",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1600 - Community Shopping Centers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ShoppingCenterCommunity",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1700 - Office Buildings One Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OfficeBuilding",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1800 - Office Buildings Multi-Story",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OfficeBuilding",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "1900 - Office Buildings Medical",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MedicalOffice",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2000 - Airports, Terminals, Piers",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "TransportationTerminal",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2100 - Restaurants, Cafeterias",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Restaurant",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2200 - Drive In Restaurants",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Restaurant",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2300 - Financial Institutions",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "FinancialInstitution",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2500 - Repair Service Shops",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2600 - Service Stations",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ServiceStation",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2700 - Auto Sales, Repair & Related",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "AutoSalesRepair",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "2800 - Parking Lots, Commercial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Commercial",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "3200 - Enclosed Theatres/Auditoriums",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Theater",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3300 - Night Clubs, Lounges, Bars",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3400 - Bowling, Skating, Pool Enclose",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3500 - Tourist Attraction, Exhibits",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Entertainment",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3800 - Golf Courses, Driving Ranges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GolfCourse",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "3900 - Hotels, Motels",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Hotel",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4000 - Vacant Industrial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Industrial",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "4100 - Light Industrial",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "LightManufacturing",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4800 - Warehousing, Distribution",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Warehouse",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "4900 - Open Storage, Supply/Junkyards",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "OpenStorage",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "5000 - Improved Agriculture",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Agricultural",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "5100 - Cropland, Class I",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "DrylandCropland",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5200 - Cropland, Class II",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "CroplandClass2",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5400 - Timberland, Index 90+",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5500 - Timberland, Index 80-90",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5600 - Timberland, Index 70-79",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5700 - Timberland, Index 60-69",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5800 - Timberland, Index 50-59",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "5900 - Timberland, Not Classed",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TimberLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6000 - Grazing, Class I",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6100 - Grazing, Class II",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6200 - Grazing, Class III",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6300 - Grazing, Class IV",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GrazingLand",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6600 - Orchard, Groves, Citrus",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "OrchardGroves",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6700 - Poultry, Bees, Fish",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Poultry",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "6900 - Ornamentals, Misc",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Ornamentals",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "7000 - Vacant Institutional",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "7100 - Churches",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Church",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7200 - Private Schools/Colleges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PrivateSchool",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7300 - Privately Owned Hospitals",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PrivateHospital",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7400 - Homes for the Aged",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Retirement",
      "property_type": "Retirement"
    },
    {
      "desoto_property_type": "7500 - Orphanages, Other Services",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "NonProfitCharity",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7600 - Mortuaries, Cemeteries",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MortuaryCemetery",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7700 - Clubs, Lodges, Union Halls",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ClubsLodges",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "7900 - Cultural Organization Facil",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "CulturalOrganization",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8000 - Vacant Governmental",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "8100 - Military",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Military",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8200 - Forest, Parks, Recreation Area",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "ForestParkRecreation",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "8300 - Public County School",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PublicSchool",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8400 - Colleges",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "CulturalOrganization",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8500 - Hospitals",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "PublicHospital",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8600 - County",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8700 - State",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8800 - Federal",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "8900 - Municipal",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "GovernmentProperty",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "9100 - Utilities",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Utility",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9200 - Mining, Petrolium/Gas",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "MineralProcessing",
      "property_type": "Building"
    },
    {
      "desoto_property_type": "9400 - Rights-of-Way",
      "ownership_estate_type": "RightOfWay",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "Unknown",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "9500 - Rivers, Lakes, Submerged Lands",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "RiversLakes",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9600 - Sewage Disposal, Solid Waste",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "SewageDisposal",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9700 - Outdoor Recreational",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Recreational",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9800 - Centrally Assessed/Railroads",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "Railroad",
      "property_type": "LandParcel"
    },
    {
      "desoto_property_type": "9900 - Vacant Acreage, Not Agri",
      "ownership_estate_type": "FeeSimple",
      "build_status": "VacantLand",
      "structure_form": null,
      "property_usage_type": "TransitionalProperty",
      "property_type": "VacantLand"
    },
    {
      "desoto_property_type": "9901 - Imp acre, Not Agri",
      "ownership_estate_type": "FeeSimple",
      "build_status": "Improved",
      "structure_form": null,
      "property_usage_type": "TransitionalProperty",
      "property_type": "LandParcel"
    }
  ];

  let mappedProperty = null;
  if (useCodeVal) {
    const codeMatch = useCodeVal.match(/\((\d{4})\)/);
    const code = codeMatch ? codeMatch[1] : null;

    if (code) {
      const desotoPropertyType = propertyTypeMapping.find(
        (item) => item.desoto_property_type && item.desoto_property_type.startsWith(code)
      );
      if (desotoPropertyType) {
        mappedProperty = desotoPropertyType;
      }
    }
  }

  if (!mappedProperty) {
    raiseEnumError(useCodeVal, "property.property_type");
    // Default to a generic type if not found to avoid script failure, or handle as an error
    mappedProperty = {
      property_type: "Unknown",
      ownership_estate_type: null,
      build_status: null,
      structure_form: null,
      property_usage_type: "Unknown"
    };
  }

  const propertyTypeDetail = mappedProperty.property_type;
  const schemaPropertyType = mapPropertyTypeToEnum(
    propertyTypeDetail,
    mappedProperty.build_status,
  );

  function mapPropertyTypeToEnum(detail, buildStatus) {
    const normalizedDetail = detail || "";
    switch (normalizedDetail) {
      case "VacantLand":
      case "LandParcel":
        return "LandParcel";
      case "MobileHome":
        return "ManufacturedHome";
      case "Condominium":
        return "Unit";
      case "ResidentialCommonElementsAreas":
        return "Building";
      case "Building":
      case "SingleFamily":
      case "Townhouse":
      case "MultiFamilyMoreThan10":
      case "MultiFamilyLessThan10":
      case "Retirement":
      case "MiscellaneousResidential":
        return "Building";
      default:
        if (buildStatus === "VacantLand") return "LandParcel";
        if (buildStatus === "Improved") return "Building";
        return "Building";
    }
  }

  // Function to determine number_of_units_type based on the detailed property_type
  function getNumberOfUnitsType(propertyType) {
    switch (propertyType) {
      case "SingleFamily":
      case "Condominium":
      case "DetachedCondominium":
      case "NonWarrantableCondo":
      case "Townhouse":
      case "MobileHome":
      case "ManufacturedHousingSingleWide":
      case "ManufacturedHousingMultiWide":
      case "ManufacturedHousing":
      case "Apartment":
      case "Cooperative":
      case "Modular":
      case "Pud":
      case "Timeshare":
      case "Retirement":
      case "MiscellaneousResidential":
      case "ResidentialCommonElementsAreas":
        return "One";
      case "Duplex":
      case "TwoUnit":
        return "Two";
      case "ThreeUnit":
        return "Three";
      case "FourUnit":
        return "Four";
      case "MultiFamilyLessThan10":
      case "MultiFamilyMoreThan10":
        return "OneToFour"; // Assuming these could be 2-4 units or more, but less than 10
      default:
        return null;
    }
  }

  const number_of_units_type_mapped = getNumberOfUnitsType(propertyTypeDetail);

  const prop = {
    source_http_request: {
      method: "GET",
      url: propertySeed?.source_http_request?.url || "https://www.bradfordappraiser.com/gis"
    },
    request_identifier: hyphenParcel,
    livable_floor_area: livable ? String(livable) : null,
    parcel_identifier: parcelIdentifier,
    property_legal_description_text: legal || null,
    property_structure_built_year: effYear || null,
    property_effective_built_year: effYear || null,
    property_type: schemaPropertyType,
    ownership_estate_type: mappedProperty.ownership_estate_type,
    build_status: mappedProperty.build_status,
    structure_form: mappedProperty.structure_form,
    property_usage_type: mappedProperty.property_usage_type,
    area_under_air: livable ? String(livable) : null,
    historic_designation: false,
    number_of_units: null, // This is an integer, not the enum type
    number_of_units_type: number_of_units_type_mapped, // Added this required field
    subdivision: null,
    total_area: totalAreaSqft,
    zoning: null,
  };
  writeJson(path.join("data", "property.json"), prop);

  if (propertyRelationshipQueue.length > 0) {
    propertyRelationshipQueue.forEach(([fromPath, toPath]) => {
      const relName = relationshipFileName(fromPath, toPath);
      writeJson(
        path.join("data", relName),
        {
          from: { "/": fromPath },
          to: { "/": toPath },
        },
      );
    });
  }


  // 7) LOT
  try {
    // Updated selector for land table
    const landRow = $(
      "#parcelDetails_LandTable table.parcelDetails_insideTable tr"
    ).eq(1); // Assuming the first data row in Land Breakdown
    const tds = landRow.find("td");
    let lotAreaSqft = null,
      lotSizeAcre = null;
    if (tds.length >= 6) {
      const unitsTxt = tds.eq(2).text(); // e.g., "1.070 AC"
      const mSf = unitsTxt.match(/([0-9,.]+)\s*SF/i);
      const mAc = unitsTxt.match(/([0-9,.]+)\s*AC/i); // Changed regex to directly capture AC value
      if (mSf) lotAreaSqft = Math.round(parseFloat(mSf[1].replace(/[,]/g, "")));
      if (mAc) lotSizeAcre = parseFloat(mAc[1].replace(/[,]/g, ""));
    }
    let lot_type = null;
    if (typeof lotSizeAcre === "number")
      lot_type =
        lotSizeAcre > 0.25
          ? "GreaterThanOneQuarterAcre"
          : "LessThanOrEqualToOneQuarterAcre";
    writeJson(path.join("data", "lot.json"), {
      lot_type: lot_type || null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_area_sqft: lotAreaSqft || null,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null,
      lot_size_acre: lotSizeAcre || null,
    });
  } catch (e) {
    console.error("Error processing lot data:", e);
  }

  // 8) ADDRESS
  try {
    const siteAddressInput =
      $('input[name="strSiteAddress"]').attr("value") || null;

    const siteAddressCell = $('td:contains("Site")')
      .filter((i, el) => $(el).text().trim() === "Site")
      .first()
      .next();

    const siteAddressText = siteAddressCell && siteAddressCell.length
      ? siteAddressCell.text().replace(/\s+/g, " ").trim()
      : null;

    const unnormalizedAddressText =
      (unnormalizedAddress && (unnormalizedAddress.full_address || unnormalizedAddress.unnormalized_address)) || null;

    const unnormalizedAddressValue =
      unnormalizedAddressText ||
      siteAddressInput ||
      siteAddressText ||
      null;

    let section = null;
    let township = null;
    let range = null;

    const strCell = $('td:contains("S/T/R")')
      .filter((i, el) => $(el).text().trim().startsWith("S/T/R"))
      .first()
      .next();

    if (strCell && strCell.length) {
      const rawStr = strCell.text().replace(/\s+/g, "").toUpperCase();
      const match = rawStr.match(/^(\d+)-([0-9A-Z]+)-([0-9A-Z]+)$/);
      if (match) {
        section = match[1] || null;
        township = match[2] || null;
        range = match[3] || null;
      }
    }

    const defaultSourceRequest =
      propertySeed?.source_http_request ||
      unnormalizedAddress?.source_http_request || {
        method: "GET",
        url:
          propertySeed?.source_http_request?.url ||
          unnormalizedAddress?.source_http_request?.url ||
          "https://www.desotopa.com/gis",
        multiValueQueryString: {},
      };

    const addressRequestIdentifier =
      propertySeed?.request_identifier ||
      propertySeed?.parcel_id ||
      unnormalizedAddress?.request_identifier ||
      hyphenParcel ||
      null;

    const addressRecord = {
      source_http_request: defaultSourceRequest,
      request_identifier: addressRequestIdentifier,
      unnormalized_address: unnormalizedAddressValue,
      section: section || null,
      township: township || null,
      range: range || null,
      county_name: propertySeed?.county_name || "DeSoto",
      country_code: "US",
    };

    writeJson(path.join("data", "address.json"), addressRecord);

    const geometryRecord = {
      source_http_request: defaultSourceRequest,
      request_identifier: addressRequestIdentifier,
      latitude:
        typeof unnormalizedAddress?.latitude === "number"
          ? unnormalizedAddress.latitude
          : null,
      longitude:
        typeof unnormalizedAddress?.longitude === "number"
          ? unnormalizedAddress.longitude
          : null,
    };

    writeJson(path.join("data", "geometry.json"), geometryRecord);

    writeJson(
      path.join("data", "relationship_address_has_geometry.json"),
      {
        from: { "/": "./address.json" },
        to: { "/": "./geometry.json" },
      },
    );
  } catch (e) {
    console.error("Error processing address data:", e);
  }
}

main();
