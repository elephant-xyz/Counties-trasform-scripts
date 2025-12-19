// ownerMapping.js
// Transform input.html into owners/owner_data.json using cheerio only for HTML parsing

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Load HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Helper: normalize a string's whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Helper: extract visible text including <br> as newlines
function textWithBreaks($el) {
  const parts = [];
  $el.contents().each((_, node) => {
    if (node.type === "text") parts.push(node.data);
    else if (node.name === "br") parts.push("\n");
    else if (node.type === "tag") parts.push(textWithBreaks($(node)));
  });
  return parts.join("");
}

// Heuristic: find parcel/property ID
function extractPropertyId($) {
  // 1) explicit hidden inputs commonly used
  const formatPIN = $('input[name="formatPIN"]').attr("value");
  if (formatPIN && norm(formatPIN)) return norm(formatPIN);

  const pin = $('input[name="PIN"]').attr("value");
  if (pin && norm(pin)) return norm(pin);

  const parcelIdBuffer = $('input[name="PARCELID_Buffer"]').attr("value");
  if (parcelIdBuffer && norm(parcelIdBuffer)) return norm(parcelIdBuffer);

  // 2) Text near "Parcel:" label
  let idFromParcel = null;
  // Updated selector to directly target the bold text within the parcelIDtable
  const boldParcelText = $(".parcelIDtable b").first().text().trim();
  if (boldParcelText) {
    // e.g., 12-05-11-0000-0000-02900 (HX HB)
    const m = boldParcelText.match(/^([^\s(]+)/);
    if (m) idFromParcel = m[1];
  }
  if (idFromParcel) return idFromParcel;

  // 3) Fallback unknown
  return "unknown_id";
}

// Heuristic: detect company names
function isCompanyName(name) {
  if (!name) return false;
  if (COMPANY_KEYWORDS_REGEX.test(name.replace(/\./g, ""))) return true;
  const normalized = name.trim().toLowerCase();
  if (/^(estate|heirs?|church|diocese)\b/.test(normalized)) return true;
  if (/\b(trust|trustee|estate)\b/.test(normalized)) return true;
  return false;
}

// Normalize for deduplication
function normalizeOwnerKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const parts = [owner.first_name, owner.middle_name || "", owner.last_name]
    .filter(Boolean)
    .join(" ");
  return norm(parts).toLowerCase();
}

function formatNameToPattern(name) {
  if (!name) return null;
  const cleaned = name.trim().replace(/\s+/g, " ");
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) =>
      part
        .split(/([-'])/)
        .map((chunk) => {
          if (chunk === "-" || chunk === "'") return chunk;
          if (!chunk) return "";
          return chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase();
        })
        .join(""),
    )
    .join(" ");
}

const PREFIX_TOKENS = new Set([
  "MR",
  "MRS",
  "MS",
  "MISS",
  "MX",
  "DR",
  "PROF",
  "REV",
  "FR",
  "SR",
  "BRO",
  "BR",
  "CAPT",
  "CAPTAIN",
  "COL",
  "MAJ",
  "MAJOR",
  "LT",
  "LIEUTENANT",
  "SGT",
  "SERGEANT",
  "HON",
  "JUDGE",
  "RABBI",
  "IMAM",
  "SHEIKH",
  "SIR",
  "DAME",
  "ATTY",
  "ATTORNEY",
  "ST",
  "SAINT",
]);

const SUFFIX_TOKENS = new Set([
  "JR",
  "SR",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "PHD",
  "MD",
  "ESQ",
  "ESQUIRE",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "EMERITUS",
  "RET",
  "TRUSTEE",
]);

const SURNAME_PREFIXES = new Set([
  "DE",
  "DEL",
  "DELA",
  "DE-",
  "DI",
  "DA",
  "DOS",
  "DES",
  "DU",
  "VAN",
  "VON",
  "MC",
  "MAC",
  "O",
  "O'",
  "ST",
  "SAINT",
  "SAN",
  "SANTA",
  "LAS",
  "LOS",
  "LA",
  "LE",
  "EL",
  "AL",
  "BIN",
  "BINT",
]);

const COMPANY_TOKENS = [
  "LLC",
  "L.L.C.",
  "INC",
  "INC.",
  "CORP",
  "CORP.",
  "CO",
  "CO.",
  "COMPANY",
  "COMPANIES",
  "TRUST",
  "TRUSTEE",
  "BANK",
  "NA",
  "N.A.",
  "FOUNDATION",
  "SOLUTIONS",
  "SERVICES",
  "ASSOCIATES",
  "ASSOCIATION",
  "HOLDINGS",
  "PARTNERS",
  "PROPERTIES",
  "PROPERTY",
  "ENTERPRISES",
  "MANAGEMENT",
  "INVESTMENTS",
  "GROUP",
  "DEVELOPMENT",
  "DEPT",
  "DEPARTMENT",
  "CITY",
  "COUNTY",
  "STATE",
  "FEDERAL",
  "CHURCH",
  "MINISTRIES",
  "SCHOOL",
  "UNIVERSITY",
  "COLLEGE",
  "ESTATE",
  "HEIRS",
  "EST",
  "AUTHORITY",
  "AUTH",
  "BOARD",
  "LLP",
  "L.L.P.",
  "PLC",
  "P.L.C.",
  "PLLC",
  "P.L.L.C.",
  "PC",
  "P.C.",
  "LP",
  "L.P.",
];

const COMPANY_KEYWORDS_REGEX = new RegExp(
  `\\b(${COMPANY_TOKENS.map((t) => t.replace(/\./g, "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`,
  "i",
);

const COMMON_FIRST_NAMES = new Set([
  "AARON",
  "ABBY",
  "ABBIE",
  "ABEL",
  "ABIGAIL",
  "ADA",
  "ADAM",
  "ADDISON",
  "ADELA",
  "ADELINE",
  "ADRIAN",
  "AIDAN",
  "AIDEN",
  "ALAN",
  "ALANA",
  "ALBERT",
  "ALDO",
  "ALEC",
  "ALEJANDRO",
  "ALEX",
  "ALEXA",
  "ALEXANDER",
  "ALEXANDRA",
  "ALEXIS",
  "ALFRED",
  "ALICE",
  "ALICIA",
  "ALLEN",
  "ALLISON",
  "ALLYSON",
  "ALMA",
  "ALONSO",
  "ALVIN",
  "AMANDA",
  "AMBER",
  "AMELIA",
  "AMY",
  "ANA",
  "ANDREA",
  "ANDRES",
  "ANDREW",
  "ANGEL",
  "ANGELA",
  "ANGELICA",
  "ANITA",
  "ANNA",
  "ANNABELLE",
  "ANNE",
  "ANNETTE",
  "ANTHONY",
  "ANTONIO",
  "APRIL",
  "ARIANA",
  "ARIEL",
  "ARMANDO",
  "ARTHUR",
  "ASHLEY",
  "ASHTON",
  "AUBREY",
  "AUDREY",
  "AURORA",
  "AUTUMN",
  "AVA",
  "AVERY",
  "AXEL",
  "BARBARA",
  "BEATRICE",
  "BECKY",
  "BELINDA",
  "BEN",
  "BENJAMIN",
  "BERNARD",
  "BETH",
  "BETSY",
  "BETTY",
  "BEVERLY",
  "BIANCA",
  "BLAKE",
  "BOB",
  "BOBBY",
  "BRAD",
  "BRADLEY",
  "BRANDON",
  "BRANDY",
  "BREANNA",
  "BRENDAN",
  "BRENT",
  "BRIAN",
  "BRIANA",
  "BRIANNA",
  "BRIDGET",
  "BROCK",
  "BROOKE",
  "BRUCE",
  "BRYAN",
  "BRYCE",
  "BRYSON",
  "CALEB",
  "CALLIE",
  "CALVIN",
  "CAMERON",
  "CARINA",
  "CARLA",
  "CARLOS",
  "CARMEN",
  "CAROL",
  "CAROLINE",
  "CAROLYN",
  "CARRIE",
  "CARSON",
  "CARTER",
  "CASEY",
  "CASSANDRA",
  "CATHERINE",
  "CECILIA",
  "CELESTE",
  "CHARLES",
  "CHARLIE",
  "CHARLOTTE",
  "CHASE",
  "CHRIS",
  "CHRISTIAN",
  "CHRISTINA",
  "CHRISTINE",
  "CHRISTOPHER",
  "CLAIRE",
  "CLARA",
  "CLARENCE",
  "CLAUDIA",
  "CLAYTON",
  "CLIFFORD",
  "CLINTON",
  "COLE",
  "COLIN",
  "COLLEEN",
  "COLTON",
  "CONNOR",
  "COOPER",
  "COREY",
  "COURTNEY",
  "CRAIG",
  "CRISTINA",
  "CRYSTAL",
  "CURTIS",
  "CYNTHIA",
  "DAISY",
  "DALE",
  "DALTON",
  "DAMIAN",
  "DAMON",
  "DAN",
  "DANIEL",
  "DANIELA",
  "DANIELLE",
  "DANNY",
  "DAREN",
  "DARLENE",
  "DARREN",
  "DAVID",
  "DAWN",
  "DEAN",
  "DEANNA",
  "DEBBIE",
  "DEBORAH",
  "DEBRA",
  "DELANEY",
  "DENISE",
  "DENNIS",
  "DEREK",
  "DESMOND",
  "DEVIN",
  "DIANA",
  "DIANE",
  "DOMINIC",
  "DON",
  "DONALD",
  "DONNA",
  "DORA",
  "DOREEN",
  "DORIS",
  "DOUGLAS",
  "DUSTIN",
  "DYLAN",
  "EDGAR",
  "EDITH",
  "EDUARDO",
  "EDWARD",
  "EDWIN",
  "ELAINA",
  "ELAINE",
  "ELENA",
  "ELI",
  "ELIAS",
  "ELIJAH",
  "ELISA",
  "ELISE",
  "ELIZA",
  "ELIZABETH",
  "ELLA",
  "ELLEN",
  "ELLIOT",
  "EMILIA",
  "EMILIO",
  "EMILY",
  "EMMA",
  "ERIC",
  "ERICA",
  "ERICK",
  "ERIK",
  "ERIKA",
  "ERNEST",
  "ESTHER",
  "ETHAN",
  "EVA",
  "EVAN",
  "EVELYN",
  "FAITH",
  "FELICIA",
  "FERNANDO",
  "FIONA",
  "FLOYD",
  "FRANCIS",
  "FRANCISCO",
  "FRANK",
  "FRANKLIN",
  "FRED",
  "FREDDY",
  "GABRIEL",
  "GABRIELA",
  "GABRIELLE",
  "GAIL",
  "GARRETT",
  "GARY",
  "GAVIN",
  "GENE",
  "GENESIS",
  "GENEVA",
  "GEORGE",
  "GEORGIA",
  "GERALD",
  "GERARD",
  "GILBERT",
  "GINA",
  "GLADYS",
  "GLEN",
  "GLENN",
  "GLORIA",
  "GRACE",
  "GRANT",
  "GRAYSON",
  "GREG",
  "GREGORY",
  "GUADALUPE",
  "GUILLERMO",
  "HAILEY",
  "HANNAH",
  "HARLEY",
  "HAROLD",
  "HARRY",
  "HEATHER",
  "HECTOR",
  "HEIDI",
  "HELEN",
  "HENRY",
  "HOLLY",
  "HOPE",
  "HUDSON",
  "HUGO",
  "IAN",
  "IDA",
  "IGNACIO",
  "IMMANUEL",
  "INES",
  "INGRID",
  "IRENE",
  "IRIS",
  "ISAAC",
  "ISABEL",
  "ISABELLA",
  "ISAI",
  "ISAIAH",
  "IVAN",
  "IVY",
  "JACOB",
  "JACQUELINE",
  "JADE",
  "JAIME",
  "JAKE",
  "JALEN",
  "JAMES",
  "JAMIE",
  "JAN",
  "JANE",
  "JANET",
  "JANICE",
  "JARED",
  "JARON",
  "JASON",
  "JASPER",
  "JAY",
  "JAYDEN",
  "JEAN",
  "JEANETTE",
  "JEFF",
  "JEFFERY",
  "JEFFREY",
  "JENNA",
  "JENNIFER",
  "JENNY",
  "JEREMIAH",
  "JEREMY",
  "JERRY",
  "JESSICA",
  "JESSIE",
  "JESUS",
  "JILL",
  "JIM",
  "JIMMIE",
  "JIMMY",
  "JO",
  "JOAN",
  "JOANNA",
  "JOANNE",
  "JOE",
  "JOEL",
  "JOEY",
  "JOHANNA",
  "JOHN",
  "JOHNNY",
  "JON",
]);

function normalizeToken(token) {
  if (!token) return "";
  return token.replace(/^[^A-Za-z0-9'-]+|[^A-Za-z0-9'-]+$/g, "").replace(/['-]/g, "").toUpperCase();
}

function cleanToken(token) {
  if (!token) return "";
  return token.replace(/^[^A-Za-z0-9'-]+|[^A-Za-z0-9'-]+$/g, "");
}

function stripEtAl(text) {
  return text
    .replace(/\bET\s+AL\b\.?/gi, "")
    .replace(/\bETAL\b\.?/gi, "")
    .replace(/\bET\s+UX\b\.?/gi, "")
    .replace(/\bET\s+VIR\b\.?/gi, "");
}

function splitOwnerSegments(raw) {
  if (!raw) return [];
  let normalized = stripEtAl(raw).trim();
  if (!normalized) return [];
  normalized = normalized.replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/\bC\/O\b.*$/i, "").trim();
  if (!normalized) return [];
  return normalized
    .replace(/\s*&\s*/g, "\n")
    .replace(/\bAND\b/gi, "\n")
    .split(/\n+/)
    .map((segment) => norm(segment))
    .filter(Boolean);
}

function isLikelyPersonFromTokens(tokensUpper) {
  // heuristic: if any token contains digits or '&', not likely a person
  return !tokensUpper.some((tok) => /\d/.test(tok) || tok.includes("&"));
}

function buildOwnersFromRaw(raw) {
  const owners = [];
  const s = norm(raw);
  if (!s) return owners;

  if (/^(c\/o|care of)\b/i.test(s)) return owners;
  if (/^(po box|p\.?o\.?\s*box)/i.test(s)) return owners;

  const segments = splitOwnerSegments(s);
  if (!segments.length) return owners;

  segments.forEach((segment) => {
    const candidate = segment.trim();
    if (!candidate) return;
    if (isCompanyName(candidate) || !isLikelyPersonFromTokens(candidate.split(/\s+/).map((t) => normalizeToken(t)))) {
      owners.push({ type: "company", name: candidate });
      return;
    }
    const persons = buildPersonFromSingleName(candidate);
    if (persons.length) owners.push(...persons);
    else owners.push({ type: "company", name: candidate });
  });

  return owners;
}

function estimateLastNamePartCount(tokensUpper) {
  if (tokensUpper.length <= 1) return tokensUpper.length;
  let count = 1;
  let idx = 1;
  let prefixRun = SURNAME_PREFIXES.has(tokensUpper[0]);
  while (idx < tokensUpper.length - 1) {
    const token = tokensUpper[idx];
    const isPrefix = SURNAME_PREFIXES.has(token);
    if (isPrefix) {
      count += 1;
      prefixRun = true;
      idx += 1;
      continue;
    }
    if (prefixRun) {
      count += 1;
      prefixRun = false;
      idx += 1;
    }
    break;
  }
  return Math.min(count, tokensUpper.length - 1);
}

function scoreNameOption(option, meta) {
  let score = 0;
  const firstUpper = normalizeToken(option.first);
  const lastUpperParts = option.lastParts.map((part) => normalizeToken(part)).filter(Boolean);

  if (COMMON_FIRST_NAMES.has(firstUpper)) score += 4;
  if (firstUpper.length === 1) score -= 3;
  if (!firstUpper) score -= 5;

  if (meta.prefixUsed && option.mode === "firstLast") score += 1;
  if (meta.prefixUsed && option.mode !== "firstLast") score -= 0.5;

  if (option.mode === "tailFirst" && firstUpper.length === 1) score -= 2;

  if (!lastUpperParts.length) score -= 4;
  if (lastUpperParts.some((part) => part === "AND" || part === "OF")) score -= 5;
  if (lastUpperParts.some((part) => COMMON_FIRST_NAMES.has(part))) score -= 1;
  if (lastUpperParts[0] && SURNAME_PREFIXES.has(lastUpperParts[0])) score += 0.5;

  (option.middleParts || []).forEach((mid) => {
    const midUpper = normalizeToken(mid);
    if (!midUpper) return;
    if (midUpper.length === 1) score += 0.5;
    else if (COMMON_FIRST_NAMES.has(midUpper)) score += 0.5;
  });

  return score;
}

function buildPersonFromSingleName(rawName) {
  const out = [];
  if (!rawName) return out;

  let cleaned = stripEtAl(rawName).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return out;

  const rawTokens = cleaned.split(/\s+/).map((t) => cleanToken(t)).filter(Boolean);
  if (rawTokens.length < 2) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const tokens = [...rawTokens];
  const tokensUpper = tokens.map((t) => normalizeToken(t));

  const heirsIndex = tokensUpper.indexOf("HEIRS");
  if (heirsIndex !== -1) {
    tokens.splice(heirsIndex);
    tokensUpper.splice(heirsIndex);
  }

  if (tokens.length < 2) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  let prefix = null;
  while (tokens.length > 2) {
    const normalizedFirst = normalizeToken(tokens[0]);
    if (PREFIX_TOKENS.has(normalizedFirst)) {
      prefix = normalizedFirst;
      tokens.shift();
      tokensUpper.shift();
    } else {
      break;
    }
  }

  let suffix = null;
  while (tokens.length > 2) {
    const normalizedLast = normalizeToken(tokens[tokens.length - 1]);
    if (SUFFIX_TOKENS.has(normalizedLast)) {
      if (!suffix) suffix = normalizedLast;
      tokens.pop();
      tokensUpper.pop();
    } else {
      break;
    }
  }

  if (tokens.length < 2) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const lastNameCount = Math.min(tokens.length - 1, estimateLastNamePartCount(tokensUpper));
  const optionLastFirst = {
    mode: "lastFirst",
    lastParts: tokens.slice(0, lastNameCount),
    first: tokens[lastNameCount],
    middleParts: tokens.slice(lastNameCount + 1),
    prefix,
    suffix,
  };

  const optionFirstLast = {
    mode: "firstLast",
    lastParts: [tokens[tokens.length - 1]],
    first: tokens[0],
    middleParts: tokens.slice(1, tokens.length - 1),
    prefix,
    suffix,
  };

  const optionTailFirst = {
    mode: "tailFirst",
    lastParts: tokens.slice(0, tokens.length - 1),
    first: tokens[tokens.length - 1],
    middleParts: [],
    prefix,
    suffix,
  };

  const evaluated = [optionLastFirst, optionFirstLast, optionTailFirst]
    .filter((opt) => opt.lastParts.length && opt.first)
    .map((opt) => ({
      option: opt,
      score: scoreNameOption(opt, { prefixUsed: Boolean(prefix) }),
    }))
    .sort((a, b) => b.score - a.score);

  if (!evaluated.length || evaluated[0].score <= -4) {
    out.push({ type: "company", name: cleaned });
    return out;
  }

  const best = evaluated[0].option;
  const person = {
    type: "person",
    first_name: formatNameToPattern(best.first),
    middle_name: best.middleParts.length ? formatNameToPattern(best.middleParts.join(" ")) : null,
    last_name: formatNameToPattern(best.lastParts.join(" ")),
    prefix_name: best.prefix || null,
    suffix_name: best.suffix || null,
  };
  out.push(person);
  return out;
}

function cloneOwner(owner) {
  if (!owner) return owner;
  if (owner.type === "company") {
    return { type: "company", name: owner.name };
  }
  return {
    type: "person",
    first_name: owner.first_name || null,
    middle_name: owner.middle_name ?? null,
    last_name: owner.last_name || null,
    prefix_name: owner.prefix_name ?? null,
    suffix_name: owner.suffix_name ?? null,
  };
}

function dedupeOwners(list) {
  const seen = new Set();
  const out = [];
  list.forEach((owner) => {
    const key = normalizeOwnerKey(owner);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(cloneOwner(owner));
  });
  return out;
}

function parseDateToISO(value) {
  if (!value) return null;
  const trimmed = value.trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

function extractGranteeTextFromRow($row) {
  let text = "";
  $row.find("[data-title]").each((_, cell) => {
    const title = String($(cell).attr("data-title") || "").toLowerCase();
    if (/grantee|buyer/.test(title)) {
      text = textWithBreaks($(cell));
      return false;
    }
    return undefined;
  });
  if (text) return text;
  const rowText = textWithBreaks($row);
  const granteeMatch = rowText.match(/grantees?:\s*([^\n]+)/i);
  if (granteeMatch) return granteeMatch[1];
  const buyerMatch = rowText.match(/buyers?:\s*([^\n]+)/i);
  if (buyerMatch) return buyerMatch[1];
  return "";
}

function extractSalesGranteeOwners($) {
  const result = new Map();
  const salesTable = $("#parcelDetails_SalesTable table.parcelDetails_insideTable");
  if (!salesTable.length) return result;

  const rows = salesTable.find("tr");
  if (!rows.length) return result;

  const headers = rows
    .first()
    .find("td,th")
    .map((_, cell) => norm($(cell).text()).toLowerCase())
    .get();

  const dateIndex = headers.findIndex((h) => h.includes("sale date"));
  const granteeIndex = headers.findIndex((h) => /grantee|buyer/.test(h));

  rows.slice(1).each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td");
    if (!cells.length) return;

    const dateCell =
      dateIndex >= 0 && dateIndex < cells.length ? cells.eq(dateIndex) : cells.first();
    const isoDate = parseDateToISO(norm(textWithBreaks(dateCell)));
    if (!isoDate) return;

    let granteeText = "";
    if (granteeIndex >= 0 && granteeIndex < cells.length) {
      granteeText = textWithBreaks(cells.eq(granteeIndex));
    }
    if (!granteeText) {
      granteeText = extractGranteeTextFromRow($row);
    }
    granteeText = norm(granteeText);
    if (!granteeText) return;

    const owners = [];
    splitOwnerSegments(granteeText).forEach((segment) => {
      if (!segment) return;
      if (isCompanyName(segment)) owners.push({ type: "company", name: segment });
      else owners.push(...buildPersonFromSingleName(segment));
    });

    const deduped = dedupeOwners(owners);
    if (!deduped.length) return;

    if (result.has(isoDate)) {
      const merged = dedupeOwners([...result.get(isoDate), ...deduped]);
      result.set(isoDate, merged);
    } else {
      result.set(isoDate, deduped);
    }
  });

  return result;
}

function extractOwnerCandidates($) {
  const cand = [];

  const strOwner = $('input[name="strOwner"]').attr("value");
  if (strOwner && norm(strOwner)) {
    const cleanOwner = strOwner.replace(/<br\s*\/?>/gi, "\n");
    const ownerLines = cleanOwner.split(/\n/).map((line) => norm(line)).filter(Boolean);
    ownerLines.forEach((line) => {
      if (
        !/\b(\d{5})(?:-\d{4})?$/.test(line) &&
        !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
        !/^\d+\s/.test(line)
      ) {
        cand.push(line);
      }
    });
  }

  if (cand.length === 0) {
    const ownerLabelTd = $('td:contains("Owner")')
      .filter(function () {
        return $(this).text().trim() === "Owner";
      })
      .first();

    if (ownerLabelTd.length) {
      const valueTd = ownerLabelTd.next("td");
      if (valueTd.length) {
        const ownerContent = textWithBreaks(valueTd);
        const ownerLines = ownerContent.split("\n").map((line) => norm(line)).filter(Boolean);

        ownerLines.forEach((line) => {
          if (
            !/\b(\d{5})(?:-\d{4})?$/.test(line) &&
            !/\b(ave|st|rd|dr|blvd|ln|lane|road|street|drive|suite|ste|fl|po box)\b/i.test(line) &&
            !/^\d+\s/.test(line)
          ) {
            cand.push(line);
          }
        });
      }
    }
  }

  const seen = new Set();
  const uniq = [];
  cand.forEach((c) => {
    const key = norm(c).toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniq.push(c);
  });
  return uniq;
}

const propertyId = extractPropertyId($);
const rawCandidates = extractOwnerCandidates($);

const invalidOwners = [];
const currentOwnerCandidates = [];
rawCandidates.forEach((raw) => {
  const built = buildOwnersFromRaw(raw);
  if (!built.length) {
    invalidOwners.push({ raw, reason: "no_owner_extracted" });
    return;
  }
  built.forEach((o) => {
    if (!o) return;
    if (o.type === "person") {
      if (!o.first_name || !o.last_name) {
        invalidOwners.push({ raw, reason: "person_missing_name_parts" });
        return;
      }
      if (!("middle_name" in o)) o.middle_name = null;
      if (!("prefix_name" in o)) o.prefix_name = null;
      if (!("suffix_name" in o)) o.suffix_name = null;
    } else if (o.type === "company") {
      if (!o.name) {
        invalidOwners.push({ raw, reason: "company_missing_name" });
        return;
      }
    } else {
      invalidOwners.push({ raw, reason: "unrecognized_type" });
      return;
    }
    currentOwnerCandidates.push(o);
  });
});

const saleOwnersByDate = extractSalesGranteeOwners($);
const saleDatesSorted = Array.from(saleOwnersByDate.keys()).sort();

let currentOwners = dedupeOwners(currentOwnerCandidates);
if (saleDatesSorted.length) {
  const latestSaleDate = saleDatesSorted[saleDatesSorted.length - 1];
  const latestOwners = saleOwnersByDate.get(latestSaleDate) || [];
  currentOwners = dedupeOwners([...currentOwners, ...latestOwners]);
}

const ownersByDate = {
  current: currentOwners,
};

saleOwnersByDate.forEach((owners, date) => {
  ownersByDate[date] = dedupeOwners(owners);
});

const output = {
  invalid_owners: invalidOwners,
};
output[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
};

const outDir = path.join("owners");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "owner_data.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

console.log(JSON.stringify(output, null, 2));
