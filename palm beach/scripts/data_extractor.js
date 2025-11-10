const fs = require("fs");
const path = require("path");
const { fetch } = require("undici");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function writeRelationshipFile(filePath, fromRelative, toRelative) {
  const hasFrom = typeof fromRelative === "string" && fromRelative.trim().length > 0;
  const hasTo = typeof toRelative === "string" && toRelative.trim().length > 0;

  if (!hasFrom || !hasTo) {
    removeFileIfExists(filePath);
    return;
  }

  const payload = {
    from: { "/": fromRelative.trim() },
    to: { "/": toRelative.trim() },
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function extractBetween(html, regex, idx = 1) {
  const m = html.match(regex);
  return m ? (m[idx] || "").trim() : null;
}

function toISODate(mdy) {
  if (!mdy) return null;
  const m = String(mdy).trim();
  const parts = m.split("/");
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts.map((x) => x.trim());
  if (!yyyy || !mm || !dd) return null;
  const MM = mm.padStart(2, "0");
  const DD = dd.padStart(2, "0");
  return `${yyyy}-${MM}-${DD}`;
}

function safeNullIfEmpty(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function normalizeWhitespace(value) {
  if (!value) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function padGridValue(value, length) {
  const cleaned = safeNullIfEmpty(value);
  if (!cleaned) return null;
  const alphanumeric = cleaned.replace(/\s+/g, "");
  if (!alphanumeric) return null;
  if (/^[0-9]+$/.test(alphanumeric)) {
    return alphanumeric.padStart(length, "0");
  }
  return alphanumeric;
}

function removeNullishFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const pruned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    pruned[key] = value;
  }
  return pruned;
}

function coerceEmptyStringsToNull(obj, fields) {
  if (!obj || typeof obj !== "object") return;
  const keys =
    Array.isArray(fields) && fields.length ? fields : Object.keys(obj);
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      obj[key] = trimmed.length ? trimmed : null;
    }
  }
}

function deepClone(value) {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return null;
  }
}

async function fetchParcelCentroid(parcelId) {
  if (process && process.env && process.env.DISABLE_PARCEL_CENTROID === "1") {
    return null;
  }
  const normalized =
    typeof parcelId === "string"
      ? normalizeParcelIdentifierForFetch(parcelId)
      : null;
  if (!normalized) return null;

  const body = new URLSearchParams({
    functionName: "getPolyByPCN",
    parameters: JSON.stringify({ pcn: normalized }),
  });

  try {
    const response = await fetch("https://maps.co.palm-beach.fl.us/giswebapi/gisdata", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!response.ok) return null;

    const text = await response.text();
    if (!text) return null;

    let payload;
    try {
      payload = JSON.parse(text);
      if (typeof payload === "string") {
        payload = JSON.parse(payload);
      }
    } catch (err) {
      return null;
    }
    if (!payload || typeof payload.point !== "string") return null;

    const [lonStr, latStr] = payload.point.split(",").map((segment) => segment.trim());
    const latitude = Number(latStr);
    const longitude = Number(lonStr);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch (err) {
    return null;
  }
}

function getGeocodeUserAgent() {
  const fromEnv =
    process &&
    process.env &&
    typeof process.env.NOMINATIM_USER_AGENT === "string" &&
    process.env.NOMINATIM_USER_AGENT.trim().length
      ? process.env.NOMINATIM_USER_AGENT.trim()
      : null;
  if (fromEnv) return fromEnv;
  return "ElephantCountyTransform/1.0 (transform@elephant.ai)";
}

async function geocodeAddress(addressText) {
  const query =
    typeof addressText === "string" ? addressText.trim() : "";
  if (!query.length) {
    return null;
  }

  const nominatimResult = await geocodeAddressWithNominatim(query);
  if (nominatimResult) {
    return nominatimResult;
  }

  return geocodeAddressWithCensus(query);
}

async function geocodeAddressWithNominatim(query) {
  const searchParams = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      {
        method: "GET",
        headers: {
          "user-agent": getGeocodeUserAgent(),
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      return null;
    }

    const first = payload[0];
    if (!first) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    const components =
      first.address && typeof first.address === "object"
        ? first.address
        : {};

    const postalCandidate =
      typeof first.postcode === "string" && first.postcode.trim().length
        ? first.postcode.trim()
        : typeof components.postcode === "string" && components.postcode.trim().length
          ? components.postcode.trim()
          : null;

    return {
      latitude,
      longitude,
      components,
      postalCode: postalCandidate,
      displayName:
        typeof first.display_name === "string" ? first.display_name.trim() : null,
    };
  } catch (error) {
    return null;
  }
}

async function geocodeAddressWithCensus(query) {
  const params = new URLSearchParams({
    address: query,
    benchmark: "2020",
    format: "json",
  });

  try {
    const response = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "user-agent": getGeocodeUserAgent(),
          accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const matches =
      payload &&
      payload.result &&
      Array.isArray(payload.result.addressMatches)
        ? payload.result.addressMatches
        : [];

    if (!matches.length) {
      return null;
    }

    const match = matches[0];
    if (!match || !match.coordinates) return null;

    const longitude = Number(match.coordinates.x);
    const latitude = Number(match.coordinates.y);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const components =
      match.addressComponents && typeof match.addressComponents === "object"
        ? {
            ...match.addressComponents,
            // Align naming with Nominatim style for downstream handling
            city: match.addressComponents.city || match.addressComponents.placeName || "",
            state_code: match.addressComponents.state || "",
            road: [
              match.addressComponents.preDirection,
              match.addressComponents.streetName,
              match.addressComponents.suffixType,
              match.addressComponents.suffixDirection,
            ]
              .filter(Boolean)
              .join(" ")
              .trim(),
            house_number:
              match.addressComponents.fromAddress ||
              match.addressComponents.toAddress ||
              match.addressComponents.houseNumber ||
              "",
          }
        : {};

    const postal =
      match.addressComponents && match.addressComponents.zip
        ? match.addressComponents.zip
        : null;

    return {
      latitude,
      longitude,
      components,
      postalCode: postal,
      displayName: match.matchedAddress || null,
    };
  } catch (error) {
    return null;
  }
}

function applyGeocodeEnhancements(address, geocodeResult) {
  if (!address || typeof address !== "object") return;
  if (!geocodeResult || typeof geocodeResult !== "object") return;

  const { latitude, longitude, components, postalCode } = geocodeResult;

  if (Number.isFinite(latitude) && !Number.isFinite(address.latitude)) {
    address.latitude = latitude;
  }
  if (Number.isFinite(longitude) && !Number.isFinite(address.longitude)) {
    address.longitude = longitude;
  }

  const componentValue = (keys) => {
    if (!components || typeof components !== "object") return null;
    for (const key of keys) {
      if (
        Object.prototype.hasOwnProperty.call(components, key) &&
        typeof components[key] === "string"
      ) {
        const trimmed = components[key].trim();
        if (trimmed.length) return trimmed;
      }
    }
    return null;
  };

  if (!address.city_name) {
    const cityCandidate = componentValue([
      "city",
      "town",
      "village",
      "hamlet",
      "municipality",
      "locality",
    ]);
    if (cityCandidate) {
      const sanitized = sanitizeCityName(cityCandidate);
      if (sanitized) address.city_name = sanitized;
    }
  }

  if (!address.municipality_name) {
    const municipality =
      componentValue(["municipality", "city", "town", "village"]) || null;
    if (municipality) {
      const titled = toTitleCase(municipality);
      if (titled) address.municipality_name = titled;
    }
  }

  if (!address.state_code) {
    const stateCode = componentValue(["state_code", "ISO3166-2-lvl4"]);
    if (stateCode) {
      address.state_code = stateCode.toUpperCase();
    } else {
      const stateName = componentValue(["state"]);
      if (stateName) {
        const abbrev = stateName.length === 2 ? stateName : null;
        if (abbrev) {
          address.state_code = abbrev.toUpperCase();
        }
      }
    }
  }

  if (!address.country_code) {
    const countryCode = componentValue(["country_code"]);
    if (countryCode) {
      address.country_code = countryCode.toUpperCase();
    }
  }

  if (!address.county_name) {
    const county = componentValue(["county"]);
    if (county) {
      const titled = toTitleCase(county);
      if (titled) address.county_name = titled;
    }
  }

  const normalizedPostal =
    typeof postalCode === "string" ? postalCode.replace(/\s+/g, "") : null;
  if (normalizedPostal && normalizedPostal.length >= 5) {
    if (!address.postal_code) {
      address.postal_code = sanitizePostalCode(normalizedPostal);
    }
    if (!address.plus_four_postal_code && normalizedPostal.includes("-")) {
      const plusMatch = normalizedPostal.split("-")[1];
      const sanitized = sanitizePlus4(plusMatch);
      if (sanitized) address.plus_four_postal_code = sanitized;
    }
    if (
      !address.plus_four_postal_code &&
      normalizedPostal.length === 9
    ) {
      const plusCandidate = sanitizePlus4(normalizedPostal.slice(5));
      if (plusCandidate) address.plus_four_postal_code = plusCandidate;
      const base = sanitizePostalCode(normalizedPostal.slice(0, 5));
      if (base && !address.postal_code) address.postal_code = base;
    }
  }

  if (!address.street_number) {
    const houseNumber = componentValue(["house_number"]);
    if (houseNumber) {
      const trimmed = String(houseNumber).trim();
      if (trimmed.length) address.street_number = trimmed;
    }
  }

  if (!address.street_name) {
    const road = componentValue(["road", "residential", "pedestrian", "footway"]);
    if (road) {
      const formatted = formatStreetNameCase(road);
      if (formatted) address.street_name = formatted.toUpperCase();
    }
  }

  if (!address.street_suffix_type && address.street_name) {
    const parts = address.street_name.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      const suffixCandidate = parts[parts.length - 1];
      const mapped = mapStreetSuffixType(suffixCandidate);
      if (mapped) {
        address.street_suffix_type = mapped;
        address.street_name = parts.slice(0, -1).join(" ");
      }
    }
  }

  if (!address.street_pre_directional_text) {
    const directional = componentValue(["road_direction"]);
    if (directional) {
      const normalized = directional.trim().toUpperCase();
      if (normalized.length) address.street_pre_directional_text = normalized;
    }
  }

  if (!address.unit_identifier) {
    const unit =
      componentValue(["unit", "house"]) ||
      (geocodeResult.displayName &&
        geocodeResult.displayName.includes("#")
        ? geocodeResult.displayName.split("#").pop()
        : null);
    if (unit) {
      const trimmed = String(unit).trim();
      if (trimmed.length) address.unit_identifier = trimmed;
    }
  }
}

function extractUnitIdentifierFromAddressLines(lines = []) {
  for (const raw of lines) {
    const candidate = safeNullIfEmpty(raw);
    if (!candidate) continue;
    const match =
      candidate.match(/(?:APT|APARTMENT|STE|SUITE|UNIT|BLDG|BUILDING|LOT|SPACE|SPC|TRLR|#)\s*([A-Z0-9-]+)/i);
    if (match && match[1]) {
      return match[1].trim().toUpperCase();
    }
  }
  return null;
}

function cleanStreetCandidate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;

  let candidate = normalized;
  if (/\bP\.?\s*O\.?\s*BOX\b/i.test(candidate) || /\bPOST OFFICE BOX\b/i.test(candidate)) {
    return null;
  }
  if (candidate.includes(",")) {
    const firstSegment = candidate.split(",")[0].trim();
    if (firstSegment) candidate = firstSegment;
  }

  if (/C\/O/i.test(candidate)) {
    const parts = candidate.split(/C\/O/i);
    const after = parts[parts.length - 1].trim();
    if (after) candidate = after;
  }

  return candidate || null;
}

function combineAddressLines(lines = []) {
  const seen = new Set();
  const filtered = [];
  for (const line of lines) {
    const cleaned = safeNullIfEmpty(line);
    if (!cleaned) continue;
    const key = cleaned.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(cleaned);
  }
  if (!filtered.length) return null;
  return filtered.join(", ");
}

function composeUnnormalizedAddress(address) {
  if (!address) return null;

  const streetPieces = [];
  const number = safeNullIfEmpty(address.street_number);
  if (number) streetPieces.push(number);

  const nameSegments = [
    safeNullIfEmpty(address.street_pre_directional_text),
    safeNullIfEmpty(address.street_name),
    safeNullIfEmpty(address.street_suffix_type),
    safeNullIfEmpty(address.street_post_directional_text),
  ].filter(Boolean);
  if (nameSegments.length) {
    streetPieces.push(nameSegments.join(" "));
  }

  const route = safeNullIfEmpty(address.route_number);
  if (route) streetPieces.push(route);

  let streetLine = streetPieces.join(" ").replace(/\s+/g, " ").trim();
  const unit = safeNullIfEmpty(address.unit_identifier);
  if (unit) {
    streetLine = streetLine ? `${streetLine}, UNIT ${unit}` : `UNIT ${unit}`;
  }

  const localityPieces = [];
  const city = safeNullIfEmpty(address.city_name);
  if (city) localityPieces.push(city);

  const state = safeNullIfEmpty(address.state_code);
  const postal = safeNullIfEmpty(address.postal_code);
  if (state || postal) {
    const statePostal = [state, postal].filter(Boolean).join(" ");
    if (statePostal) {
      const plus4 = safeNullIfEmpty(address.plus_four_postal_code);
      localityPieces.push(plus4 ? `${statePostal}-${plus4}` : statePostal);
    }
  }

  const localityLine = localityPieces.join(", ").replace(/\s+/g, " ").trim();

  const segments = [streetLine, localityLine]
    .map((segment) => (segment || "").trim())
    .filter((segment) => segment.length);

  if (!segments.length) return null;

  const county = safeNullIfEmpty(address.county_name);
  if (county) {
    const countyUpper = county.toUpperCase();
    const alreadyHasCounty = segments.some((segment) =>
      segment.toUpperCase().includes(countyUpper),
    );
    if (!alreadyHasCounty) {
      segments.push(county);
    }
  }

  return segments.join(", ");
}

function enrichAddressFromUnnormalized(address, unnormalizedValue) {
  if (!address || typeof address !== "object") return;
  const normalizedSource = normalizeWhitespace(unnormalizedValue);
  if (!normalizedSource) return;

  const segments = normalizedSource
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) return;

  const streetSegment = segments[0];
  if (streetSegment) {
    const parsedStreet = parseLocationAddress(streetSegment);
    if (parsedStreet.streetNumber && !address.street_number) {
      address.street_number = safeNullIfEmpty(parsedStreet.streetNumber);
    }
    if (parsedStreet.streetName && !address.street_name) {
      const formatted = formatStreetNameCase(parsedStreet.streetName);
      address.street_name = formatted ? formatted.toUpperCase() : null;
    }
    if (parsedStreet.streetPreDirectional && !address.street_pre_directional_text) {
      address.street_pre_directional_text = parsedStreet.streetPreDirectional.toUpperCase();
    }
    if (parsedStreet.streetPostDirectional && !address.street_post_directional_text) {
      address.street_post_directional_text = parsedStreet.streetPostDirectional.toUpperCase();
    }
    if (parsedStreet.streetSuffix && !address.street_suffix_type) {
      const mappedSuffix = mapStreetSuffixType(parsedStreet.streetSuffix);
      if (mappedSuffix) {
        address.street_suffix_type = mappedSuffix;
      }
    }
    if (parsedStreet.unitIdentifier && !address.unit_identifier) {
      address.unit_identifier = safeNullIfEmpty(parsedStreet.unitIdentifier);
    }
    if (parsedStreet.routeNumber && !address.route_number) {
      address.route_number = safeNullIfEmpty(parsedStreet.routeNumber);
    }
  }

  if (segments.length > 1) {
    const cityStateSegment = segments.slice(1).join(" ");
    const parsedCityState = parseCityStatePostal(cityStateSegment);
    if (parsedCityState.city && !address.city_name) {
      const cityCandidate = parsedCityState.city.toUpperCase();
      if (!/\d/.test(cityCandidate)) {
        address.city_name = cityCandidate;
      }
    }
    if (parsedCityState.state && !address.state_code) {
      address.state_code = parsedCityState.state.toUpperCase();
    }
    if (parsedCityState.postal && !address.postal_code) {
      address.postal_code = parsedCityState.postal;
    }
    if (parsedCityState.plus4 && !address.plus_four_postal_code) {
      address.plus_four_postal_code = parsedCityState.plus4;
    }
  }
}

function titleCaseCounty(county) {
  if (!county) return null;
  const lc = String(county).toLowerCase();
  const map = {
    "miami dade": "Miami Dade",
    broward: "Broward",
    "palm beach": "Palm Beach",
    lee: "Lee",
    hillsborough: "Hillsborough",
    orange: "Orange",
    pinellas: "Pinellas",
    polk: "Polk",
    duval: "Duval",
    brevard: "Brevard",
    pasco: "Pasco",
    volusia: "Volusia",
    sarasota: "Sarasota",
    collier: "Collier",
    marion: "Marion",
    manatee: "Manatee",
    charlotte: "Charlotte",
    lake: "Lake",
    osceola: "Osceola",
    "st. lucie": "St. Lucie",
    seminole: "Seminole",
    escambia: "Escambia",
    "st. johns": "St. Johns",
    citrus: "Citrus",
    bay: "Bay",
    "santa rosa": "Santa Rosa",
    hernando: "Hernando",
    okaloosa: "Okaloosa",
    highlands: "Highlands",
    leon: "Leon",
    alachua: "Alachua",
    clay: "Clay",
    sumter: "Sumter",
    putnam: "Putnam",
    martin: "Martin",
    "indian river": "Indian River",
    walton: "Walton",
    monroe: "Monroe",
    flagler: "Flagler",
    nassau: "Nassau",
    levy: "Levy",
    washington: "Washington",
    jackson: "Jackson",
    suwannee: "Suwannee",
    columbia: "Columbia",
    hendry: "Hendry",
    okeechobee: "Okeechobee",
    gadsden: "Gadsden",
    wakulla: "Wakulla",
    desoto: "DeSoto",
    gulf: "Gulf",
    taylor: "Taylor",
    franklin: "Franklin",
    dixie: "Dixie",
    madison: "Madison",
    bradford: "Bradford",
    hardee: "Hardee",
    gilchrist: "Gilchrist",
    holmes: "Holmes",
    calhoun: "Calhoun",
    hamilton: "Hamilton",
    baker: "Baker",
    jefferson: "Jefferson",
    glades: "Glades",
    lafayette: "Lafayette",
    union: "Union",
    liberty: "Liberty",
  };
  return map[lc] || toTitleCase(county);
}

const STREET_DIRECTIONS = new Set([
  "N",
  "S",
  "E",
  "W",
  "NE",
  "NW",
  "SE",
  "SW",
]);

const UNIT_KEYWORDS = new Set([
  "APT",
  "UNIT",
  "STE",
  "SUITE",
  "BLDG",
  "BUILDING",
  "FL",
  "FLOOR",
  "LOT",
  "RM",
  "ROOM",
  "TRLR",
  "TRAILER",
  "SPC",
  "SPACE",
  "#",
]);

const STREET_SUFFIX_ENUM = [
  "Rds",
  "Blvd",
  "Lk",
  "Pike",
  "Ky",
  "Vw",
  "Curv",
  "Psge",
  "Ldg",
  "Mt",
  "Un",
  "Mdw",
  "Via",
  "Cor",
  "Kys",
  "Vl",
  "Pr",
  "Cv",
  "Isle",
  "Lgt",
  "Hbr",
  "Btm",
  "Hl",
  "Mews",
  "Hls",
  "Pnes",
  "Lgts",
  "Strm",
  "Hwy",
  "Trwy",
  "Skwy",
  "Is",
  "Est",
  "Vws",
  "Ave",
  "Exts",
  "Cvs",
  "Row",
  "Rte",
  "Fall",
  "Gtwy",
  "Wls",
  "Clb",
  "Frk",
  "Cpe",
  "Fwy",
  "Knls",
  "Rdg",
  "Jct",
  "Rst",
  "Spgs",
  "Cir",
  "Crst",
  "Expy",
  "Smt",
  "Trfy",
  "Cors",
  "Land",
  "Uns",
  "Jcts",
  "Ways",
  "Trl",
  "Way",
  "Trlr",
  "Aly",
  "Spg",
  "Pkwy",
  "Cmn",
  "Dr",
  "Grns",
  "Oval",
  "Cirs",
  "Pt",
  "Shls",
  "Vly",
  "Hts",
  "Clf",
  "Flt",
  "Mall",
  "Frds",
  "Cyn",
  "Lndg",
  "Mdws",
  "Rd",
  "Xrds",
  "Ter",
  "Prt",
  "Radl",
  "Grvs",
  "Rdgs",
  "Inlt",
  "Trak",
  "Byu",
  "Vlgs",
  "Ctr",
  "Ml",
  "Cts",
  "Arc",
  "Bnd",
  "Riv",
  "Flds",
  "Mtwy",
  "Msn",
  "Shrs",
  "Rue",
  "Crse",
  "Cres",
  "Anx",
  "Drs",
  "Sts",
  "Holw",
  "Vlg",
  "Prts",
  "Sta",
  "Fld",
  "Xrd",
  "Wall",
  "Tpke",
  "Ft",
  "Bg",
  "Knl",
  "Plz",
  "St",
  "Cswy",
  "Bgs",
  "Rnch",
  "Frks",
  "Ln",
  "Mtn",
  "Ctrs",
  "Orch",
  "Iss",
  "Brks",
  "Br",
  "Fls",
  "Trce",
  "Park",
  "Gdns",
  "Rpds",
  "Shl",
  "Lf",
  "Rpd",
  "Lcks",
  "Gln",
  "Pl",
  "Path",
  "Vis",
  "Lks",
  "Run",
  "Frg",
  "Brg",
  "Sqs",
  "Xing",
  "Pln",
  "Glns",
  "Blfs",
  "Plns",
  "Dl",
  "Clfs",
  "Ext",
  "Pass",
  "Gdn",
  "Brk",
  "Grn",
  "Mnr",
  "Cp",
  "Pne",
  "Spur",
  "Opas",
  "Upas",
  "Tunl",
  "Sq",
  "Lck",
  "Ests",
  "Shr",
  "Dm",
  "Mls",
  "Wl",
  "Mnrs",
  "Stra",
  "Frgs",
  "Frst",
  "Flts",
  "Ct",
  "Mtns",
  "Frd",
  "Nck",
  "Ramp",
  "Vlys",
  "Pts",
  "Bch",
  "Loop",
  "Byp",
  "Cmns",
  "Fry",
  "Walk",
  "Hbrs",
  "Dv",
  "Hvn",
  "Blf",
  "Grv",
  "Crk",
];

const NORMALIZED_ADDRESS_FIELDS = [
  "latitude",
  "longitude",
  "city_name",
  "country_code",
  "plus_four_postal_code",
  "postal_code",
  "state_code",
  "street_name",
  "street_post_directional_text",
  "street_pre_directional_text",
  "street_number",
  "street_suffix_type",
  "unit_identifier",
  "route_number",
  "township",
  "range",
  "section",
  "block",
  "lot",
  "county_name",
  "municipality_name",
];

const RAW_ADDRESS_CORE_FIELDS = [
  "latitude",
  "longitude",
  "city_name",
  "state_code",
  "postal_code",
  "plus_four_postal_code",
  "country_code",
  "county_name",
  "municipality_name",
];

const RAW_ADDRESS_GRID_FIELDS = ["township", "range", "section"];
const RAW_ADDRESS_OPTIONAL_GRID_FIELDS = ["block", "lot"];

const RAW_ADDRESS_STREET_FIELDS = [
  "street_number",
  "street_name",
  "street_suffix_type",
  "street_pre_directional_text",
  "street_post_directional_text",
  "unit_identifier",
  "route_number",
];

const RAW_ADDRESS_ALLOWED_FIELDS = [
  ...RAW_ADDRESS_CORE_FIELDS,
  ...RAW_ADDRESS_GRID_FIELDS,
  ...RAW_ADDRESS_OPTIONAL_GRID_FIELDS,
  ...RAW_ADDRESS_STREET_FIELDS,
];

// Downstream validation expects the raw branch to carry the full field surface
// with key pieces populated. These required fields mirror the normalized branch
// so that either variant satisfies the address oneOf contract.
const RAW_SCHEMA_REQUIRED_FIELDS = [
  "latitude",
  "longitude",
  "street_number",
  "street_name",
  "street_suffix_type",
  "city_name",
  "state_code",
  "postal_code",
  "country_code",
  "county_name",
];

const ADDRESS_SCHEMA_FIELDS = [
  ...new Set([
    ...NORMALIZED_ADDRESS_FIELDS,
    ...RAW_ADDRESS_ALLOWED_FIELDS,
    "unnormalized_address",
  ]),
];

const RAW_ADDRESS_OUTPUT_FIELDS = [...RAW_ADDRESS_ALLOWED_FIELDS];

const RAW_ADDRESS_SCHEMA_TEMPLATE = Object.freeze(
  RAW_ADDRESS_OUTPUT_FIELDS.reduce((acc, field) => {
    acc[field] = null;
    return acc;
  }, {}),
);

function hasMeaningfulAddressValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

function ensureRawAddressRequiredCoverage(rawAddress, unnormalizedValue) {
  if (!rawAddress || typeof rawAddress !== "object") return null;

  const normalizedUnnormalized =
    typeof unnormalizedValue === "string" ? unnormalizedValue.trim() : "";

  const candidate = {
    ...rawAddress,
  };

  if (
    normalizedUnnormalized.length &&
    (!Object.prototype.hasOwnProperty.call(candidate, "unnormalized_address") ||
      !hasMeaningfulAddressValue(candidate.unnormalized_address))
  ) {
    candidate.unnormalized_address = normalizedUnnormalized;
  }

  if (normalizedUnnormalized.length) {
    enrichAddressFromUnnormalized(candidate, normalizedUnnormalized);
  }

  if (
    hasMeaningfulAddressValue(candidate.state_code) &&
    !hasMeaningfulAddressValue(candidate.country_code)
  ) {
    candidate.country_code = "US";
  }

  for (const field of RAW_SCHEMA_REQUIRED_FIELDS) {
    const value = candidate[field];
    if (!hasMeaningfulAddressValue(value)) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) {
        return null;
      }
      switch (field) {
        case "city_name": {
          const sanitized = sanitizeCityName(trimmed);
          if (!sanitized) return null;
          candidate[field] = sanitized;
          break;
        }
        case "postal_code": {
          const postal = sanitizePostalCode(trimmed);
          if (!postal) return null;
          candidate[field] = postal;
          break;
        }
        case "state_code":
        case "country_code":
          candidate[field] = trimmed.toUpperCase();
          break;
        case "county_name": {
          const titled = toTitleCase(trimmed);
          if (!titled) return null;
          candidate[field] = titled;
          break;
        }
        case "street_suffix_type": {
          const mapped = mapStreetSuffixType(trimmed);
          candidate[field] = mapped || trimmed;
          if (!hasMeaningfulAddressValue(candidate[field])) {
            return null;
          }
          break;
        }
        default:
          candidate[field] = trimmed;
      }
    }
  }

  return candidate;
}

const NORMALIZED_ADDRESS_REQUIRED_STRING_FIELDS = [
  "street_number",
  "street_name",
  "street_suffix_type",
  "city_name",
  "state_code",
  "postal_code",
  "country_code",
  "county_name",
];

const NORMALIZED_ADDRESS_REQUIRED_COORDINATE_FIELDS = ["latitude", "longitude"];

const ADDRESS_REQUIRED_COORDINATE_FIELDS = [
  ...NORMALIZED_ADDRESS_REQUIRED_COORDINATE_FIELDS,
];

const NORMALIZED_SCHEMA_REQUIRED_FIELDS = [
  "latitude",
  "longitude",
  "street_number",
  "street_name",
  "street_suffix_type",
  "city_name",
  "state_code",
  "postal_code",
  "country_code",
  "county_name",
];

function hasCompleteNormalizedAddress(address) {
  if (!address || typeof address !== "object") return false;
  for (const field of NORMALIZED_ADDRESS_REQUIRED_STRING_FIELDS) {
    const value = address[field];
    if (typeof value !== "string") {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed.length) {
      return false;
    }

    if (field === "street_suffix_type") {
      const normalizedSuffix = mapStreetSuffixType(trimmed);
      if (!normalizedSuffix) {
        return false;
      }
      address[field] = normalizedSuffix;
      continue;
    }

    if (field === "city_name") {
      const sanitizedCity = sanitizeCityName(trimmed);
      if (!sanitizedCity) return false;
      address[field] = sanitizedCity;
      continue;
    }

    if (field === "state_code" || field === "country_code") {
      address[field] = trimmed.toUpperCase();
      continue;
    }

    if (field === "postal_code") {
      const sanitizedPostal = sanitizePostalCode(trimmed);
      if (!sanitizedPostal) return false;
      address[field] = sanitizedPostal;
      continue;
    }

    if (field === "county_name") {
      const titledCounty = toTitleCase(trimmed);
      if (!titledCounty || !titledCounty.trim().length) {
        return false;
      }
      address[field] = titledCounty;
      continue;
    }

    address[field] = trimmed;
  }
  for (const field of NORMALIZED_ADDRESS_REQUIRED_COORDINATE_FIELDS) {
    const rawValue = address[field];
    if (rawValue == null || rawValue === "") {
      address[field] = null;
      continue;
    }

    let numericValue = null;
    if (typeof rawValue === "number") {
      numericValue = Number.isFinite(rawValue) ? rawValue : null;
    } else if (typeof rawValue === "string") {
      const parsed = Number(rawValue.trim());
      numericValue = Number.isFinite(parsed) ? parsed : null;
    }

    address[field] = numericValue != null ? numericValue : null;
  }
  return true;
}

function isNormalizedAddressSchemaReady(address) {
  if (!address || typeof address !== "object") return false;
  for (const field of NORMALIZED_SCHEMA_REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(address, field)) {
      return false;
    }
    const value = address[field];
    if (NORMALIZED_ADDRESS_REQUIRED_STRING_FIELDS.includes(field)) {
      if (typeof value !== "string" || !value.trim().length) {
        return false;
      }
      continue;
    }

    if (ADDRESS_REQUIRED_COORDINATE_FIELDS.includes(field)) {
      if (value === null || value === undefined || value === "") {
        return false;
      }
      const numeric =
        typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(numeric)) {
        return false;
      }
      address[field] = numeric;
      continue;
    }

    if (field === "street_suffix_type") {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value !== "string" || !value.trim().length) {
        return false;
      }
      const mappedSuffix = mapStreetSuffixType(value);
      if (mappedSuffix) {
        address[field] = mappedSuffix;
      }
      continue;
    }

    if (field === "county_name") {
      if (typeof value !== "string" || !value.trim().length) {
        return false;
      }
    }
  }
  return true;
}

function ensureAddressVariantIsSchemaCompliant(address, variant, options = {}) {
  if (!address || typeof address !== "object") return null;
  const cloned = deepClone(address);
  if (!cloned || typeof cloned !== "object") return null;

  if (variant === "normalized") {
    const normalizedCandidate = createSchemaReadyAddress(cloned, "normalized");
    if (!normalizedCandidate) return null;
    if (!isNormalizedAddressSchemaReady(normalizedCandidate)) {
      return null;
    }
    return normalizedCandidate;
  }

  if (variant === "raw") {
    const rawCandidate = createSchemaReadyAddress(cloned, "raw", {
      fallbackUnnormalized: cloned.unnormalized_address || null,
      allowedRawFields: options.allowedRawFields,
    });
    if (
      !rawCandidate ||
      typeof rawCandidate !== "object" ||
      typeof rawCandidate.unnormalized_address !== "string"
    ) {
      return null;
    }
    return rawCandidate;
  }

  return null;
}

function finalizeAddressForOutput(address, variant, options = {}) {
  if (!address || typeof address !== "object") return null;

  const cloned = deepClone(address);
  if (!cloned || typeof cloned !== "object") return null;

  if (variant === "raw") {
    const allowedRawFields =
      (options && Array.isArray(options.allowedRawFields) && options.allowedRawFields.length
        ? options.allowedRawFields
        : RAW_ADDRESS_ALLOWED_FIELDS);
    const sanitized = pruneRawAddressForSchema(cloned, {
      allowedFields: allowedRawFields,
      preserveNulls: true,
    });
    if (!sanitized) return null;

    const result = {};
    const orderedFields = ["unnormalized_address", ...allowedRawFields];
    for (const field of orderedFields) {
      const hasValue = Object.prototype.hasOwnProperty.call(sanitized, field);
      let value = hasValue ? sanitized[field] : null;

      if (field === "unnormalized_address") {
        const resolved =
          typeof value === "string" && value.trim().length
            ? value.trim()
            : typeof cloned.unnormalized_address === "string"
              ? cloned.unnormalized_address.trim()
              : "";
        if (!resolved.length) {
          return null;
        }
        result[field] = resolved;
        continue;
      }

      if (value === undefined || value === null) {
        result[field] = null;
        continue;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        result[field] = trimmed.length ? trimmed : null;
        continue;
      }

      if (typeof value === "number") {
        result[field] = Number.isFinite(value) ? value : null;
        continue;
      }

      if (typeof value === "boolean") {
        result[field] = value;
        continue;
      }

      const stringified = String(value).trim();
      result[field] = stringified.length ? stringified : null;
    }

    if (!Object.prototype.hasOwnProperty.call(result, "unnormalized_address")) {
      return null;
    }

    if (!result.postal_code && result.plus_four_postal_code) {
      result.plus_four_postal_code = null;
    }
    if (!result.country_code && result.state_code) {
      result.country_code = "US";
    }

    return result;
  }

  const result = {};
  const normalizedFields = [
    ...NORMALIZED_ADDRESS_FIELDS,
    "county_name",
    "municipality_name",
  ];

  for (const field of normalizedFields) {
    let value = Object.prototype.hasOwnProperty.call(cloned, field)
      ? cloned[field]
      : null;

    if (value === undefined || value === null) {
      result[field] = null;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) {
        result[field] = null;
        continue;
      }

      if (field === "city_name") {
        result[field] = sanitizeCityName(trimmed) || null;
        continue;
      }

      if (field === "postal_code") {
        result[field] = sanitizePostalCode(trimmed) || null;
        continue;
      }

      if (field === "plus_four_postal_code") {
        result[field] = sanitizePlus4(trimmed) || null;
        continue;
      }

      if (
        field === "state_code" ||
        field === "country_code" ||
        field === "street_pre_directional_text" ||
        field === "street_post_directional_text"
      ) {
        const upper = trimmed.toUpperCase();
        result[field] = upper.length ? upper : null;
        continue;
      }

      if (field === "street_suffix_type") {
        const mapped = mapStreetSuffixType(trimmed);
        const normalizedSuffix = mapped || trimmed;
        result[field] = normalizedSuffix && normalizedSuffix.length ? normalizedSuffix : null;
        continue;
      }

      if (field === "county_name" || field === "municipality_name") {
        const titled = toTitleCase(trimmed);
        result[field] = titled || null;
        continue;
      }

      result[field] = trimmed;
      continue;
    }

    if (typeof value === "number") {
      result[field] = Number.isFinite(value) ? value : null;
      continue;
    }

    result[field] = value;
  }

  if (!result.country_code && result.state_code) {
    result.country_code = "US";
  }
  if (!result.postal_code) {
    result.plus_four_postal_code = null;
  }

  if (Object.prototype.hasOwnProperty.call(result, "unnormalized_address")) {
    delete result.unnormalized_address;
  }

  return result;
}

function collectAddressFields(source, fields, options = {}) {
  const { preserveNulls = false, omitNulls = false } = options;
  const result = {};
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      if (preserveNulls && !omitNulls) result[field] = null;
      continue;
    }
    const value = source[field];
    if (value == null) {
      if (preserveNulls && !omitNulls) result[field] = null;
      continue;
    }
    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        result[field] = value;
      } else if (preserveNulls && !omitNulls) {
        result[field] = null;
      }
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length) {
        result[field] = trimmed;
      } else if (preserveNulls && !omitNulls) {
        result[field] = null;
      }
      continue;
    }
    result[field] = value;
  }
  return result;
}

function buildRawAddressPayload(address, unnormalizedValue, options = {}) {
  const trimmedValue =
    typeof unnormalizedValue === "string" ? unnormalizedValue.trim() : "";
  if (!trimmedValue) return null;

  const sourceAddress =
    address && typeof address === "object" ? address : {};
  const rawAddress = { unnormalized_address: trimmedValue };
  const allowedFields =
    (options && Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_ALLOWED_FIELDS);

  for (const field of allowedFields) {
    let value = Object.prototype.hasOwnProperty.call(sourceAddress, field)
      ? sourceAddress[field]
      : null;

    if (typeof value === "number") {
      value = Number.isFinite(value) ? value : null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      value = trimmed.length ? trimmed : null;
    } else if (value == null) {
      value = null;
    } else {
      value = null;
    }

    if (field === "city_name") {
      value = sanitizeCityName(value);
    } else if (field === "postal_code") {
      value = value ? sanitizePostalCode(value) || null : null;
    } else if (field === "plus_four_postal_code") {
      value = value ? sanitizePlus4(value) || null : null;
    } else if (field === "state_code" && typeof value === "string") {
      value = value.toUpperCase();
    } else if (field === "country_code" && typeof value === "string") {
      value = value.toUpperCase();
    }

    rawAddress[field] = value != null ? value : null;
  }

  if (!rawAddress.country_code && rawAddress.state_code) {
    rawAddress.country_code = "US";
  }

  if (
    Object.prototype.hasOwnProperty.call(rawAddress, "plus_four_postal_code") &&
    !rawAddress.postal_code
  ) {
    rawAddress.plus_four_postal_code = null;
  }

  if (rawAddress.city_name && /\d/.test(rawAddress.city_name)) {
    rawAddress.city_name = null;
  }

  return rawAddress;
}

function prepareRawAddressForSchema(rawAddress, options = {}) {
  if (!rawAddress || typeof rawAddress !== "object") return null;

  const rawUnnormalized =
    typeof rawAddress.unnormalized_address === "string"
      ? rawAddress.unnormalized_address.trim()
      : "";
  if (!rawUnnormalized.length) return null;

  const allowedFields =
    (options && Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_ALLOWED_FIELDS);

  const prepared = { unnormalized_address: rawUnnormalized };
  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(rawAddress, field)) continue;

    const isCoordinateField = ADDRESS_REQUIRED_COORDINATE_FIELDS.includes(field);
    let value = rawAddress[field];

    if (value == null) continue;

    if (typeof value === "string") {
      value = value.trim();
      if (!value.length) continue;
    }

    if (isCoordinateField) {
      const numeric =
        typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) continue;
      prepared[field] = numeric;
      continue;
    }

    if (field === "country_code") {
      const trimmed = String(value).trim().toUpperCase();
      if (!trimmed.length) continue;
      value = trimmed;
    } else if (field === "city_name") {
      value = sanitizeCityName(value);
      if (!value) continue;
    } else if (field === "postal_code") {
      value = sanitizePostalCode(value) || null;
      if (!value) continue;
    } else if (field === "plus_four_postal_code") {
      value = sanitizePlus4(value) || null;
      if (!value) continue;
    } else if (field === "state_code") {
      const trimmed = String(value).trim().toUpperCase();
      if (!trimmed.length) continue;
      value = trimmed;
    } else if (field === "county_name" || field === "municipality_name") {
      const titled = toTitleCase(String(value));
      value = titled && titled.trim().length ? titled : null;
      if (!value) continue;
    } else if (
      typeof value !== "boolean" &&
      typeof value !== "number"
    ) {
      const trimmed = String(value).trim();
      if (!trimmed.length) continue;
      value = trimmed;
    }

    prepared[field] = value;
  }

  if (
    Object.prototype.hasOwnProperty.call(prepared, "state_code") &&
    !Object.prototype.hasOwnProperty.call(prepared, "country_code")
  ) {
    prepared.country_code = "US";
  }

  if (
    !Object.prototype.hasOwnProperty.call(prepared, "postal_code") &&
    Object.prototype.hasOwnProperty.call(prepared, "plus_four_postal_code")
  ) {
    prepared.plus_four_postal_code = null;
  }

  return Object.keys(prepared).length ? prepared : null;
}

function ensureAddressFieldsForOutput(address, variant, options = {}) {
  if (!address || typeof address !== "object") return address;

  const clone = { ...address };
  const skipFieldsSet =
    options && options.skipFields instanceof Set
      ? options.skipFields
      : new Set(
          Array.isArray(options.skipFields) ? options.skipFields : [],
        );
  const shouldSkip = (field) =>
    skipFieldsSet.size &&
    skipFieldsSet.has(field) &&
    !Object.prototype.hasOwnProperty.call(clone, field);

  if (variant === "normalized") {
    if (Object.prototype.hasOwnProperty.call(clone, "unnormalized_address")) {
      delete clone.unnormalized_address;
    }

    for (const field of NORMALIZED_ADDRESS_FIELDS) {
      if (shouldSkip(field)) continue;
      if (!Object.prototype.hasOwnProperty.call(clone, field)) {
        clone[field] = null;
      }

      let value = clone[field];
      if (value === undefined || value === null) {
        clone[field] = null;
        continue;
      }

      if (typeof value === "string") {
        value = value.trim();
        if (!value.length) {
          clone[field] = null;
          continue;
        }
      }

      switch (field) {
        case "city_name":
          clone[field] = sanitizeCityName(value) || null;
          break;
        case "state_code":
        case "country_code":
        case "street_pre_directional_text":
        case "street_post_directional_text":
          clone[field] = String(value).trim().toUpperCase() || null;
          break;
        case "postal_code":
          clone[field] = sanitizePostalCode(value) || null;
          break;
        case "plus_four_postal_code":
          clone[field] = sanitizePlus4(value) || null;
          break;
        case "street_suffix_type": {
          const mapped = mapStreetSuffixType(value);
          clone[field] =
            mapped ||
            (typeof value === "string" ? value.trim() || null : null);
          break;
        }
        case "street_name":
          clone[field] =
            typeof value === "string" ? value.trim().toUpperCase() || null : null;
          break;
        case "unit_identifier":
        case "route_number":
          clone[field] =
            typeof value === "string" ? value.trim() || null : null;
          break;
        case "county_name":
        case "municipality_name": {
          const titled = toTitleCase(String(value));
          clone[field] = titled && titled.trim().length ? titled : null;
          break;
        }
        case "latitude":
        case "longitude": {
          const numeric =
            typeof value === "number" ? value : Number(String(value).trim());
          clone[field] = Number.isFinite(numeric) ? numeric : null;
          break;
        }
        case "township":
          clone[field] = padGridValue(value, 2);
          break;
        case "range":
          clone[field] = padGridValue(value, 2);
          break;
        case "section":
          clone[field] = padGridValue(value, 2);
          break;
        case "block":
          clone[field] = padGridValue(value, 3);
          break;
        case "lot":
          clone[field] = padGridValue(value, 4);
          break;
        default:
          clone[field] = value;
      }
    }

    return clone;
  }

  if (variant === "raw") {
    const allowedFields =
      options &&
      Array.isArray(options.allowedFields) &&
      options.allowedFields.length
        ? options.allowedFields
        : RAW_ADDRESS_ALLOWED_FIELDS;

    if (
      !Object.prototype.hasOwnProperty.call(clone, "unnormalized_address") &&
      !shouldSkip("unnormalized_address")
    ) {
      clone.unnormalized_address = null;
    }

    for (const field of allowedFields) {
      if (shouldSkip(field)) continue;
      if (!Object.prototype.hasOwnProperty.call(clone, field)) {
        clone[field] = null;
      }

      let value = clone[field];
      if (value === undefined || value === null) {
        clone[field] = null;
        continue;
      }

      if (typeof value === "string") {
        value = value.trim();
        if (!value.length) {
          clone[field] = null;
          continue;
        }
      }

      switch (field) {
        case "city_name":
          clone[field] = sanitizeCityName(value) || null;
          break;
        case "state_code":
        case "country_code":
        case "street_pre_directional_text":
        case "street_post_directional_text":
          clone[field] = String(value).trim().toUpperCase() || null;
          break;
        case "postal_code":
          clone[field] = sanitizePostalCode(value) || null;
          break;
        case "plus_four_postal_code":
          clone[field] = sanitizePlus4(value) || null;
          break;
        case "street_suffix_type": {
          const mapped = mapStreetSuffixType(value);
          clone[field] =
            mapped ||
            (typeof value === "string" ? value.trim() || null : null);
          break;
        }
        case "street_name":
          clone[field] =
            typeof value === "string" ? value.trim().toUpperCase() || null : null;
          break;
        case "unit_identifier":
        case "route_number":
          clone[field] =
            typeof value === "string" ? value.trim() || null : null;
          break;
        case "county_name":
        case "municipality_name": {
          const titled = toTitleCase(String(value));
          clone[field] = titled && titled.trim().length ? titled : null;
          break;
        }
        case "latitude":
        case "longitude": {
          const numeric =
            typeof value === "number" ? value : Number(String(value).trim());
          clone[field] = Number.isFinite(numeric) ? numeric : null;
          break;
        }
        case "township":
          clone[field] = padGridValue(value, 2);
          break;
        case "range":
          clone[field] = padGridValue(value, 2);
          break;
        case "section":
          clone[field] = padGridValue(value, 2);
          break;
        case "block":
          clone[field] = padGridValue(value, 3);
          break;
        case "lot":
          clone[field] = padGridValue(value, 4);
          break;
        default:
          clone[field] = value;
      }
    }

    return clone;
  }

  return clone;
}

function createSchemaReadyAddress(address, variant, options = {}) {
  if (!address || typeof address !== "object") return null;

  const {
    fallbackUnnormalized = null,
    allowedRawFields = RAW_ADDRESS_ALLOWED_FIELDS,
  } = options;

  const normalizeFieldValue = (field, value) => {
    if (value == null) return null;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) return null;
      value = trimmed;
    }

    if (ADDRESS_REQUIRED_COORDINATE_FIELDS.includes(field)) {
      if (typeof value === "string") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        value = numeric;
      } else if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
      } else {
        return null;
      }
    }

    if (field === "city_name") {
      return sanitizeCityName(value);
    }
    if (field === "postal_code") {
      return sanitizePostalCode(value) || null;
    }
    if (field === "plus_four_postal_code") {
      return sanitizePlus4(value) || null;
    }
    if (
      field === "state_code" ||
      field === "country_code" ||
      field === "street_pre_directional_text" ||
      field === "street_post_directional_text"
    ) {
      if (typeof value === "string") {
        return value.toUpperCase();
      }
      return value;
    }
    if (field === "street_suffix_type" && typeof value === "string") {
      const mappedSuffix = mapStreetSuffixType(value);
      return mappedSuffix || value;
    }
    if (field === "street_name" && typeof value === "string") {
      return value.toUpperCase();
    }

    return value;
  };

  const resolvedUnnormalized = (() => {
    if (
      typeof address.unnormalized_address === "string" &&
      address.unnormalized_address.trim().length
    ) {
      return address.unnormalized_address.trim();
    }
    if (
      typeof fallbackUnnormalized === "string" &&
      fallbackUnnormalized.trim().length
    ) {
      return fallbackUnnormalized.trim();
    }
    return "";
  })();

  if (variant === "normalized") {
    const normalized = {};
    for (const field of NORMALIZED_ADDRESS_FIELDS) {
      const candidate = Object.prototype.hasOwnProperty.call(address, field)
        ? address[field]
        : null;
      normalized[field] = normalizeFieldValue(field, candidate);
    }

    if (normalized.state_code && !normalized.country_code) {
      normalized.country_code = "US";
    }
    if (!normalized.postal_code) {
      normalized.plus_four_postal_code = null;
    }

    return normalized;
  }

  const shouldBuildRaw =
    variant === "raw" || (!variant && resolvedUnnormalized.length);

  if (shouldBuildRaw) {
    if (!resolvedUnnormalized.length) {
      return null;
    }

    const rawPayload = {};
    const fieldsToUse =
      Array.isArray(allowedRawFields) && allowedRawFields.length
        ? allowedRawFields
        : RAW_ADDRESS_ALLOWED_FIELDS;
    for (const field of fieldsToUse) {
      const candidate = Object.prototype.hasOwnProperty.call(address, field)
        ? address[field]
        : null;
      const normalizedValue = normalizeFieldValue(field, candidate);
      rawPayload[field] = normalizedValue != null ? normalizedValue : null;
    }

    if (rawPayload.state_code && !rawPayload.country_code) {
      rawPayload.country_code = "US";
    }
    if (!rawPayload.postal_code) {
      rawPayload.plus_four_postal_code = null;
    }

    rawPayload.unnormalized_address = resolvedUnnormalized;
    const sanitizedRaw = pruneRawAddressForSchema(rawPayload, {
      allowedFields: fieldsToUse,
      preserveNulls: true,
    });
    if (!sanitizedRaw || !Object.keys(sanitizedRaw).length) {
      return null;
    }

    const coverageReady = ensureRawAddressRequiredCoverage(
      sanitizedRaw,
      resolvedUnnormalized,
    );
    if (!coverageReady) {
      return null;
    }

    const normalizedRaw = pruneRawAddressForSchema(coverageReady, {
      allowedFields: fieldsToUse,
      preserveNulls: true,
    });
    if (normalizedRaw && Object.keys(normalizedRaw).length) {
      return normalizedRaw;
    }
    return null;
  }

  return null;
}

const STREET_SUFFIX_SYNONYMS = {
  RD: "Rd",
  ROAD: "Rd",
  DRIVE: "Dr",
  DR: "Dr",
  STREET: "St",
  ST: "St",
  AVE: "Ave",
  AVENUE: "Ave",
  HIGHWAY: "Hwy",
  HWY: "Hwy",
  LANE: "Ln",
  LN: "Ln",
  COURT: "Ct",
  CT: "Ct",
  CIRCLE: "Cir",
  CIR: "Cir",
  PARKWAY: "Pkwy",
  PKWY: "Pkwy",
  TERRACE: "Ter",
  TER: "Ter",
  PLACE: "Pl",
  PL: "Pl",
  BOULEVARD: "Blvd",
  BLVD: "Blvd",
  DRIVEWAY: "Dr",
  TRL: "Trl",
  TRAIL: "Trl",
  WAY: "Way",
};

const STREET_SUFFIX_LOOKUP = new Map(
  STREET_SUFFIX_ENUM.map((value) => [value.toUpperCase(), value]),
);

for (const [key, value] of Object.entries(STREET_SUFFIX_SYNONYMS)) {
  if (!STREET_SUFFIX_LOOKUP.has(key)) {
    STREET_SUFFIX_LOOKUP.set(key, value);
  }
}

function mapStreetSuffixType(token) {
  if (!token) return null;
  const cleaned = token.replace(/\./g, "").toUpperCase();
  if (STREET_SUFFIX_LOOKUP.has(cleaned)) {
    return STREET_SUFFIX_LOOKUP.get(cleaned);
  }
  return null;
}

function parseCityStatePostal(raw) {
  const parsed = {
    city: null,
    state: null,
    postal: null,
    plus4: null,
  };
  const normalized = normalizeWhitespace(raw);
  if (!normalized) return parsed;

  const cleaned = normalized.replace(/,/g, "").toUpperCase();
  const cityStateZipMatch = cleaned.match(
    /^(.+?)\s+([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?$/,
  );
  if (cityStateZipMatch) {
    parsed.city = cityStateZipMatch[1].trim();
    parsed.state = cityStateZipMatch[2].trim();
    parsed.postal = cityStateZipMatch[3];
    parsed.plus4 = cityStateZipMatch[4] || null;
    return parsed;
  }

  const stateZipMatch = cleaned.match(/([A-Z]{2})\s+(\d{5})(?:\s+(\d{4}))?/);
  if (stateZipMatch) {
    parsed.state = stateZipMatch[1].trim();
    parsed.postal = stateZipMatch[2];
    parsed.plus4 = stateZipMatch[3] || null;
    const cityCandidate = cleaned.slice(0, stateZipMatch.index).trim();
    if (cityCandidate && !/\d/.test(cityCandidate)) {
      parsed.city = cityCandidate;
    }
    return parsed;
  }

  const postalMatch = cleaned.match(/\b(\d{5})(?:\s+(\d{4}))?\b/);
  if (postalMatch) {
    parsed.postal = postalMatch[1];
    parsed.plus4 = postalMatch[2] || null;
  }
  return parsed;
}

function parseLocationAddress(raw) {
  const result = {
    streetNumber: null,
    streetName: null,
    streetPreDirectional: null,
    streetPostDirectional: null,
    streetSuffix: null,
    unitIdentifier: null,
    routeNumber: null,
  };

  const normalized = normalizeWhitespace(raw);
  if (!normalized) return result;

  const tokens = normalized
    .toUpperCase()
    .split(/\s+/)
    .map((token) => token.replace(/[.,]/g, ""));
  if (!tokens.length) return result;

  const numberPattern = /^\d+[A-Z]?$/i;
  let numberIndex = numberPattern.test(tokens[0]) ? 0 : tokens.findIndex((token) => numberPattern.test(token));

  if (numberIndex > 0) {
    const leadingTokens = tokens.slice(0, numberIndex);
    if (!result.unitIdentifier && leadingTokens.length) {
      const leadingUnitMatch = leadingTokens.join(" ").match(
        /(?:APT|UNIT|SUITE|STE|BLDG|BUILDING|FL|FLOOR|LOT|TRLR|TRAILER|SPC|SPACE|#)\s*([A-Z0-9-]+)/i,
      );
      if (leadingUnitMatch && leadingUnitMatch[1]) {
        result.unitIdentifier = leadingUnitMatch[1].replace(/^#/, "");
      }
    }
    tokens.splice(0, numberIndex);
  } else if (numberIndex === -1) {
    numberIndex = 0;
  }

  const first = tokens[0];
  if (numberPattern.test(first)) {
    result.streetNumber = first;
    tokens.shift();

    if (
      tokens.length &&
      /^\d+\s*\/\s*\d+$/.test(tokens[0])
    ) {
      const fractionToken = tokens.shift().replace(/\s*/g, "");
      if (fractionToken.length) {
        result.streetNumber = `${result.streetNumber} ${fractionToken}`;
      }
    }
  }

  if (!tokens.length) return result;

  const consumePostDirectional = () => {
    if (!tokens.length) return;
    const candidate = tokens[tokens.length - 1].toUpperCase();
    if (!STREET_DIRECTIONS.has(candidate)) return;
    if (tokens.length >= 2) {
      const previousToken = tokens[tokens.length - 2].toUpperCase();
      if (UNIT_KEYWORDS.has(previousToken)) {
        return;
      }
    }
    result.streetPostDirectional = candidate;
    tokens.pop();
  };

  const maybePre = tokens[0].toUpperCase();
  if (STREET_DIRECTIONS.has(maybePre)) {
    result.streetPreDirectional = maybePre;
    tokens.shift();
  }

  if (!tokens.length) return result;

  consumePostDirectional();
  if (!tokens.length) return result;

  // Handle explicit unit keywords (UNIT 5, APT B, STE 2, etc.)
  if (tokens.length >= 2) {
    const keyword = tokens[tokens.length - 2].toUpperCase();
    if (UNIT_KEYWORDS.has(keyword)) {
      if (!result.unitIdentifier) {
        result.unitIdentifier = tokens[tokens.length - 1];
      }
      tokens.pop();
      tokens.pop();
    }
  }

  if (!tokens.length) return result;

  const removeTrailingUnitToken = () => {
    if (!tokens.length) return false;
    const lastToken = tokens[tokens.length - 1];
    if (!lastToken) return false;
    const normalizedLast = lastToken.toUpperCase();
    if (STREET_DIRECTIONS.has(normalizedLast)) return false;
    if (mapStreetSuffixType(lastToken)) return false;

  const ordinalRegex = /^\d+(ST|ND|RD|TH)$/;
  const hasHashPrefix = lastToken.startsWith("#");
  const hasDigits = /\d/.test(lastToken);
  const looksOrdinal = ordinalRegex.test(lastToken);
  const isCompactToken = /^[#A-Z0-9-]+$/.test(lastToken) && lastToken.length <= 6;

  if (isCompactToken && (hasHashPrefix || (hasDigits && !looksOrdinal))) {
    if (!result.unitIdentifier) {
      result.unitIdentifier = lastToken.replace(/^#/, "");
    }
    tokens.pop();
    return true;
  }

  const isAlphaToken = /^[A-Z]{1,4}$/.test(normalizedLast);
  if (isCompactToken && !hasDigits && isAlphaToken) {
    const prevToken = tokens.length > 1 ? tokens[tokens.length - 2].toUpperCase() : null;
    const prevIsDirectional = prevToken ? STREET_DIRECTIONS.has(prevToken) : false;
    const prevIsSuffix = prevToken ? mapStreetSuffixType(prevToken) : null;
    const prevIsUnitKeyword = prevToken ? UNIT_KEYWORDS.has(prevToken) : false;
    if (prevIsDirectional || prevIsSuffix || prevIsUnitKeyword) {
      if (!result.unitIdentifier) {
        result.unitIdentifier = lastToken;
      }
      tokens.pop();
      return true;
    }
  }
  return false;
};

removeTrailingUnitToken();
consumePostDirectional();

  if (!tokens.length) return result;

  const suffixToken = tokens[tokens.length - 1];
  const suffix = mapStreetSuffixType(suffixToken);
  if (suffix) {
    result.streetSuffix = suffix;
    tokens.pop();
  }

  if (!tokens.length) return result;

  consumePostDirectional();
  if (!tokens.length) return result;

  const remaining = tokens.join(" ").trim();
  if (!remaining) return result;

  const routePatterns = [
    { regex: /^(?:US|U\.S\.)\s+(?:HWY|HIGHWAY)\s+([A-Z0-9-]+)$/, name: "US Highway" },
    { regex: /^(?:US|U\.S\.)\s+([A-Z0-9-]+)$/, name: "US Highway" },
    { regex: /^(?:STATE\s+(?:ROAD|RD)|SR)\s+([A-Z0-9-]+)$/, name: "State Road" },
    { regex: /^(?:COUNTY\s+(?:ROAD|RD)|CR)\s+([A-Z0-9-]+)$/, name: "County Road" },
    { regex: /^(?:HWY|HIGHWAY)\s+([A-Z0-9-]+)$/, name: "Highway" },
    { regex: /^(?:ROUTE|RTE)\s+([A-Z0-9-]+)$/, name: "Route" },
  ];

  for (const pattern of routePatterns) {
    const match = remaining.match(pattern.regex);
    if (match) {
      result.routeNumber = match[1];
      result.streetName = pattern.name.toUpperCase();
      return result;
    }
  }

  result.streetName = remaining;
  return result;
}

function sanitizePostalCode(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\D/g, "");
  if (cleaned.length >= 5) return cleaned.slice(0, 5);
  return null;
}

function sanitizePlus4(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/\D/g, "");
  if (cleaned.length >= 4) return cleaned.slice(0, 4);
  return null;
}

function sanitizeCityName(value) {
  if (value == null) return null;
  const upper = String(value).toUpperCase();
  const cleaned = upper.replace(/[^A-Z\s\-']/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned.length) return null;
  return cleaned;
}

function pruneAddressComponentsForSchema(address) {
  if (!address || typeof address !== "object") return;
  const removedFields = new Set();
  const hasMeaningfulValue = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return true;
  };

  if (hasMeaningfulValue(address.city_name)) {
    const sanitizedCity = sanitizeCityName(address.city_name);
    address.city_name = sanitizedCity || null;
  }

  if (
    hasMeaningfulValue(address.plus_four_postal_code) &&
    !hasMeaningfulValue(address.postal_code)
  ) {
    delete address.plus_four_postal_code;
    removedFields.add("plus_four_postal_code");
  }

  const streetFields = [
    "street_number",
    "street_name",
    "street_suffix_type",
    "street_pre_directional_text",
    "street_post_directional_text",
    "unit_identifier",
    "route_number",
  ];
  const streetRequired = ["street_number", "street_name", "street_suffix_type"];
  const hasStreetData = streetFields.some((field) =>
    hasMeaningfulValue(address[field]),
  );
  const missingStreetRequired = streetRequired.some(
    (field) => !hasMeaningfulValue(address[field]),
  );
  if (hasStreetData && missingStreetRequired) {
    for (const field of streetFields) {
      delete address[field];
      removedFields.add(field);
    }
  }

  const gridFields = ["township", "range", "section", "block"];
  const hasGridData = gridFields.some((field) =>
    hasMeaningfulValue(address[field]),
  );
  const missingGridField = gridFields.some(
    (field) => !hasMeaningfulValue(address[field]),
  );
  if (hasGridData && missingGridField) {
    for (const field of [...gridFields, "lot"]) {
      delete address[field];
      removedFields.add(field);
    }
  }

  return removedFields;
}

function pruneRawAddressForSchema(address, options = {}) {
  if (!address || typeof address !== "object") return null;

  const unnormalized =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  if (!unnormalized.length) {
    return null;
  }

  const sanitizeField = (field, rawValue) => {
    if (rawValue == null) return null;

    if (typeof rawValue === "boolean") {
      return rawValue;
    }

    if (typeof rawValue === "number") {
      return Number.isFinite(rawValue) ? rawValue : null;
    }

    if (typeof rawValue !== "string") {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed.length) {
      return null;
    }

    switch (field) {
      case "latitude":
      case "longitude": {
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : null;
      }
      case "city_name":
        return sanitizeCityName(trimmed);
      case "postal_code":
        return sanitizePostalCode(trimmed);
      case "plus_four_postal_code":
        return sanitizePlus4(trimmed);
      case "state_code":
      case "country_code":
      case "street_pre_directional_text":
      case "street_post_directional_text":
        return trimmed.toUpperCase();
      case "street_suffix_type": {
        const mapped = mapStreetSuffixType(trimmed);
        return mapped || trimmed;
      }
      default:
        return trimmed;
    }
  };

  const allowedFields =
    (options && Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_ALLOWED_FIELDS);

  const preserveNulls =
    options && Object.prototype.hasOwnProperty.call(options, "preserveNulls")
      ? Boolean(options.preserveNulls)
      : false;

  const pruned = { unnormalized_address: unnormalized };
  for (const field of allowedFields) {
    const hasField = Object.prototype.hasOwnProperty.call(address, field);
    if (!hasField) {
      if (preserveNulls) {
        pruned[field] = null;
      }
      continue;
    }
    const sanitized = sanitizeField(field, address[field]);
    if (sanitized != null) {
      pruned[field] = sanitized;
    } else if (preserveNulls) {
      pruned[field] = null;
    }
  }

  if (preserveNulls) {
    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(pruned, field)) {
        pruned[field] = null;
      }
    }
  }

  if (
    !Object.prototype.hasOwnProperty.call(pruned, "postal_code") &&
    Object.prototype.hasOwnProperty.call(pruned, "plus_four_postal_code")
  ) {
    if (preserveNulls) {
      pruned.plus_four_postal_code = null;
    } else {
      delete pruned.plus_four_postal_code;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(pruned, "state_code") &&
    !Object.prototype.hasOwnProperty.call(pruned, "country_code")
  ) {
    pruned.country_code = "US";
  }

  return pruned;
}

function stripNormalizedFieldsFromRaw(address) {
  // No-op: the schema expects the normalized keys even on the raw branch when
  // they are available, so we intentionally retain them (they may be null).
  if (!address || typeof address !== "object") return;
}

function formatRawAddressForOutput(address, options = {}) {
  if (!address || typeof address !== "object") return null;

  const rawUnnormalized =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  if (!rawUnnormalized.length) {
    return null;
  }

  const result = { unnormalized_address: rawUnnormalized };
  const transformers = {
    latitude: (value) => parseCoordinate(value),
    longitude: (value) => parseCoordinate(value),
    city_name: (value) => sanitizeCityName(value),
    state_code: (value) =>
      value == null ? null : String(value).trim().toUpperCase(),
    postal_code: (value) => sanitizePostalCode(value),
    plus_four_postal_code: (value) => sanitizePlus4(value),
    country_code: (value) =>
      value == null ? null : String(value).trim().toUpperCase(),
    county_name: (value) => {
      if (value == null) return null;
      const titled = toTitleCase(String(value));
      return titled && titled.trim().length ? titled : null;
    },
    municipality_name: (value) => {
      if (value == null) return null;
      const titled = toTitleCase(String(value));
      return titled && titled.trim().length ? titled : null;
    },
    street_number: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    },
    street_name: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed.toUpperCase() : null;
    },
    street_suffix_type: (value) => {
      if (value == null) return null;
      const mapped = mapStreetSuffixType(value);
      if (mapped) return mapped;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    },
    street_pre_directional_text: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim().toUpperCase();
      return trimmed.length ? trimmed : null;
    },
    street_post_directional_text: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim().toUpperCase();
      return trimmed.length ? trimmed : null;
    },
    unit_identifier: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed.toUpperCase() : null;
    },
    route_number: (value) => {
      if (value == null) return null;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : null;
    },
    township: (value) => padGridValue(value, 2),
    range: (value) => padGridValue(value, 2),
    section: (value) => padGridValue(value, 2),
    block: (value) => padGridValue(value, 3),
    lot: (value) => padGridValue(value, 4),
  };

  const allowedFields =
    (options && Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_OUTPUT_FIELDS);

  for (const field of allowedFields) {
    const transformer =
      Object.prototype.hasOwnProperty.call(transformers, field)
        ? transformers[field]
        : null;

    const hasRawValue = Object.prototype.hasOwnProperty.call(address, field);
    const rawValue = hasRawValue ? address[field] : null;
    let transformed =
      typeof transformer === "function" ? transformer(rawValue) : rawValue;

    if (typeof transformed === "number") {
      result[field] = Number.isFinite(transformed) ? transformed : null;
      continue;
    }

    if (typeof transformed === "boolean") {
      result[field] = transformed;
      continue;
    }

    if (typeof transformed === "string") {
      const trimmed = transformed.trim();
      result[field] = trimmed.length ? trimmed : null;
      continue;
    }

    if (transformed === undefined) {
      transformed = null;
    }

    result[field] =
      transformed !== null && transformed !== undefined ? transformed : null;
  }

  if (result.state_code && !result.country_code) {
    result.country_code = "US";
  }

  if (!result.postal_code && Object.prototype.hasOwnProperty.call(result, "plus_four_postal_code")) {
    result.plus_four_postal_code = null;
  }

  return Object.keys(result).length ? result : null;
}

function ensureRawAddressFieldCoverage(address, allowedFields = RAW_ADDRESS_OUTPUT_FIELDS) {
  if (!address || typeof address !== "object") return null;

  const unnormalized =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  if (!unnormalized.length) {
    return null;
  }

  const fields = Array.isArray(allowedFields) && allowedFields.length
    ? allowedFields
    : RAW_ADDRESS_OUTPUT_FIELDS;
  const allowedSet = new Set(fields);
  const result = { unnormalized_address: unnormalized };

  for (const field of fields) {
    const hasValue = Object.prototype.hasOwnProperty.call(address, field);
    const value = hasValue ? address[field] : null;
    result[field] = value === undefined ? null : value;
  }

  for (const [key, value] of Object.entries(address)) {
    if (key === "unnormalized_address") continue;
    if (allowedSet.has(key)) continue;
    result[key] = value;
  }

  return result;
}

function buildRawSchemaAlignedAddress(address) {
  if (!address || typeof address !== "object") return null;

  const unnormalized =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  if (!unnormalized.length) {
    return null;
  }

  const aligned = { unnormalized_address: unnormalized };
  for (const field of RAW_ADDRESS_OUTPUT_FIELDS) {
    const value = Object.prototype.hasOwnProperty.call(address, field)
      ? address[field]
      : undefined;

    if (value === undefined || value === null) {
      aligned[field] = null;
      continue;
    }

    if (ADDRESS_REQUIRED_COORDINATE_FIELDS.includes(field)) {
      const numeric = parseCoordinate(value);
      aligned[field] = numeric != null ? numeric : null;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      aligned[field] = trimmed.length ? trimmed : null;
      continue;
    }

    if (typeof value === "number") {
      aligned[field] = Number.isFinite(value) ? value : null;
      continue;
    }

    aligned[field] = value;
  }

  if (aligned.state_code && !aligned.country_code) {
    aligned.country_code = "US";
  }
  if (!aligned.postal_code) {
    aligned.plus_four_postal_code = null;
  }

  return aligned;
}

function ensureRawAddressSchemaDefaults(address) {
  if (!address || typeof address !== "object") return null;

  const result = {
    ...RAW_ADDRESS_SCHEMA_TEMPLATE,
    ...address,
  };

  for (const field of RAW_ADDRESS_OUTPUT_FIELDS) {
    if (
      !Object.prototype.hasOwnProperty.call(result, field) ||
      result[field] === undefined
    ) {
      result[field] = null;
    }
  }

  return result;
}

function buildAddressSchemaSurface(address, variant, options = {}) {
  if (!address || typeof address !== "object") return null;

  const unnormalizedFromAddress =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  const unnormalizedFromOptions =
    options && typeof options.trimmedUnnormalized === "string"
      ? options.trimmedUnnormalized.trim()
      : "";
  const fallbackOption =
    options && typeof options.fallbackUnnormalized === "string"
      ? options.fallbackUnnormalized.trim()
      : "";
  const fallbackUnnormalized =
    unnormalizedFromAddress.length
      ? unnormalizedFromAddress
      : unnormalizedFromOptions.length
        ? unnormalizedFromOptions
        : fallbackOption;

  const normalizedRequested = variant === "normalized";
  const rawRequested =
    variant === "raw" || (!normalizedRequested && fallbackUnnormalized);

  if (normalizedRequested) {
    const prepared = ensureAddressFieldsForOutput(address, "normalized");
    if (!prepared) return null;

    const surface = {};
    for (const field of NORMALIZED_ADDRESS_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(prepared, field)) {
        surface[field] = prepared[field];
      } else {
        surface[field] = null;
      }
    }

    if (surface.state_code && !surface.country_code) {
      surface.country_code = "US";
    }
    if (!surface.postal_code) {
      surface.plus_four_postal_code = null;
    }

    return surface;
  }

  if (rawRequested) {
    const seed = {
      ...address,
      unnormalized_address: fallbackUnnormalized,
    };

    const prepared = ensureAddressFieldsForOutput(seed, "raw", {
      allowedFields: RAW_ADDRESS_OUTPUT_FIELDS,
    });
    if (!prepared) return null;

    const trimmedUnnormalized =
      typeof prepared.unnormalized_address === "string"
        ? prepared.unnormalized_address.trim()
        : "";
    if (!trimmedUnnormalized.length) return null;

    const surface = { unnormalized_address: trimmedUnnormalized };
    for (const field of RAW_ADDRESS_OUTPUT_FIELDS) {
      const hasValue = Object.prototype.hasOwnProperty.call(prepared, field);
      let value = hasValue ? prepared[field] : null;

      if (field === "latitude" || field === "longitude") {
        const numeric = parseCoordinate(value);
        value = numeric != null ? numeric : null;
      } else if (typeof value === "string") {
        const trimmed = value.trim();
        value = trimmed.length ? trimmed : null;
      }

      surface[field] = value === undefined ? null : value;
    }

    if (surface.state_code && !surface.country_code) {
      surface.country_code = "US";
    }
    if (!surface.postal_code) {
      surface.plus_four_postal_code = null;
    }

    return surface;
  }

  return null;
}

function prepareAddressForSchema(address, variant) {
  if (!address || typeof address !== "object") return null;

  const clone = { ...address };
  const targetFields =
    variant === "normalized" ? NORMALIZED_ADDRESS_FIELDS : RAW_ADDRESS_OUTPUT_FIELDS;

  for (const field of targetFields) {
    if (!Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = null;
    }
  }

  if (variant === "normalized") {
    if (Object.prototype.hasOwnProperty.call(clone, "unnormalized_address")) {
      delete clone.unnormalized_address;
    }
  } else if (variant === "raw") {
    if (
      typeof clone.unnormalized_address !== "string" ||
      !clone.unnormalized_address.trim().length
    ) {
      return null;
    }
    clone.unnormalized_address = clone.unnormalized_address.trim();
  }

  for (const field of ADDRESS_REQUIRED_COORDINATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = null;
      continue;
    }

    const numeric = parseCoordinate(clone[field]);
    clone[field] = numeric != null ? numeric : null;
  }

  if (
    Object.prototype.hasOwnProperty.call(clone, "plus_four_postal_code") &&
    !clone.postal_code
  ) {
    clone.plus_four_postal_code = null;
  }

  if (clone.state_code && !clone.country_code) {
    clone.country_code = "US";
  }

  return clone;
}

function deriveGridPartsFromPcn(rawPcn) {
  if (!rawPcn) return {};
  const normalized = normalizeWhitespace(String(rawPcn));
  if (!normalized) return {};
  const tokens = normalized
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);
  const grid = {};
  if (tokens.length >= 4) {
    grid.township = tokens[1] || null;
    grid.range = tokens[2] || null;
    grid.section = tokens[3] || null;
  }
  if (tokens.length >= 6) grid.block = tokens[5] || null;
  if (tokens.length >= 7) grid.lot = tokens[6] || null;
  return grid;
}

function fillAddressStreetComponents(address, streetCandidates) {
  const seen = new Set();
  for (const candidate of streetCandidates) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const parsed = parseLocationAddress(normalized);

    if (parsed.streetNumber && !address.street_number) {
      address.street_number = safeNullIfEmpty(parsed.streetNumber);
    }
    if (parsed.streetPreDirectional && !address.street_pre_directional_text) {
      address.street_pre_directional_text = parsed.streetPreDirectional.toUpperCase();
    }
    if (parsed.streetPostDirectional && !address.street_post_directional_text) {
      address.street_post_directional_text = parsed.streetPostDirectional.toUpperCase();
    }
    if (parsed.streetSuffix && !address.street_suffix_type) {
      address.street_suffix_type = safeNullIfEmpty(parsed.streetSuffix);
    }
    if (parsed.streetName && !address.street_name) {
      const formatted = safeNullIfEmpty(formatStreetNameCase(parsed.streetName));
      address.street_name = formatted ? formatted.toUpperCase() : null;
    }
    if (parsed.unitIdentifier && !address.unit_identifier) {
      address.unit_identifier = safeNullIfEmpty(parsed.unitIdentifier);
    }
    if (parsed.routeNumber && !address.route_number) {
      address.route_number = safeNullIfEmpty(parsed.routeNumber);
    }
  }

  if (address.street_number && address.street_name && address.street_suffix_type) {
    return;
  }

  for (const candidate of streetCandidates) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized) continue;
    const parts = normalized
      .replace(/[.,]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) continue;

    let idxStart = 0;
    let idxEnd = parts.length;

    if (!address.street_number) {
      const numberIdx = parts.findIndex((part) => /^\d+[A-Z]?$/i.test(part));
      if (numberIdx !== -1) {
        address.street_number = parts[numberIdx];
        idxStart = numberIdx + 1;
      }
    }

    if (!address.street_pre_directional_text && idxStart < idxEnd) {
      const maybePre = parts[idxStart].toUpperCase();
      if (STREET_DIRECTIONS.has(maybePre)) {
        address.street_pre_directional_text = maybePre;
        idxStart += 1;
      }
    }

    if (!address.street_post_directional_text && idxStart < idxEnd) {
      const maybePost = parts[idxEnd - 1].toUpperCase();
      if (STREET_DIRECTIONS.has(maybePost)) {
        address.street_post_directional_text = maybePost;
        idxEnd -= 1;
      }
    }

    if (!address.street_suffix_type && idxStart < idxEnd) {
      const maybeSuffix = parts[idxEnd - 1];
      const mappedSuffix = mapStreetSuffixType(maybeSuffix);
      if (mappedSuffix) {
        address.street_suffix_type = mappedSuffix;
        idxEnd -= 1;
      }
    }

    if (!address.street_name && idxEnd > idxStart) {
      const nameTokens = parts.slice(idxStart, idxEnd);
      if (nameTokens.length) {
        const formatted = safeNullIfEmpty(formatStreetNameCase(nameTokens.join(" ")));
        address.street_name = formatted ? formatted.toUpperCase() : null;
      }
    }

    if (
      address.street_number &&
      address.street_name &&
      address.street_suffix_type
    ) {
      break;
    }
  }
}

function applyAddressFallbacks(address, options = {}) {
  const {
    streetCandidates = [],
    fallbackCity = null,
    fallbackState = null,
    fallbackPostal = null,
    fallbackPlus4 = null,
    municipality = null,
    county = null,
    formattedPcn = null,
    legalDescription = null,
  } = options;

  if (!address.city_name && fallbackCity) {
    const fallbackCityUpper = fallbackCity.toUpperCase();
    if (!/\d/.test(fallbackCityUpper)) {
      address.city_name = fallbackCityUpper;
    }
  }
  if (!address.state_code && fallbackState) {
    address.state_code = fallbackState.toUpperCase();
  }
  address.postal_code = sanitizePostalCode(address.postal_code || fallbackPostal);
  address.plus_four_postal_code =
    sanitizePlus4(address.plus_four_postal_code || fallbackPlus4);

  if (!address.country_code && (address.state_code || address.postal_code)) {
    address.country_code = "US";
  }

  if (!address.municipality_name && municipality) {
    address.municipality_name = toTitleCase(municipality);
  }
  if (!address.city_name && address.municipality_name) {
    const municipalityUpper = address.municipality_name.toUpperCase();
    if (!/\d/.test(municipalityUpper)) {
      address.city_name = municipalityUpper;
    }
  }

  if (!address.county_name && county) {
    address.county_name = toTitleCase(county);
  }

  fillAddressStreetComponents(address, streetCandidates);

  address.street_pre_directional_text = address.street_pre_directional_text
    ? address.street_pre_directional_text.toUpperCase()
    : null;
  address.street_post_directional_text = address.street_post_directional_text
    ? address.street_post_directional_text.toUpperCase()
    : null;
  address.street_name = address.street_name ? address.street_name.toUpperCase() : null;

  if (formattedPcn) {
    const parts = deriveGridPartsFromPcn(formattedPcn);
    for (const key of ["section", "township", "range", "block", "lot"]) {
      if (!address[key] && parts[key]) {
        address[key] = parts[key];
      }
    }
  }

  if (legalDescription) {
    const normalized = legalDescription.toUpperCase();
    if (!address.lot) {
      const lotMatch =
        normalized.match(/\bLOT\s+([A-Z0-9-]+)/) ||
        normalized.match(/\bLT\s+([A-Z0-9-]+)/);
      if (lotMatch) address.lot = lotMatch[1];
    }
    if (!address.block) {
      const blockMatch =
        normalized.match(/\bBLOCK\s+([A-Z0-9-]+)/) ||
        normalized.match(/\bBLK\s+([A-Z0-9-]+)/);
      if (blockMatch) address.block = blockMatch[1];
    }
  }
}

function formatStreetNameCase(value) {
  if (!value) return null;
  const tokens = String(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (upper === "US" || upper === "SR" || upper === "CR") return upper;
      if (word.length === 1) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  return tokens.length ? tokens.join(" ") : null;
}

function parseCoordinate(value) {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const match = stringValue.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildRawAddressOutput(address, options = {}) {
  if (!address || typeof address !== "object") return null;

  const allowedFields =
    Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_ALLOWED_FIELDS;
  const trimmedUnnormalized =
    typeof options.trimmedUnnormalized === "string"
      ? options.trimmedUnnormalized.trim()
      : "";

  let unnormalized = "";
  if (
    typeof address.unnormalized_address === "string" &&
    address.unnormalized_address.trim().length
  ) {
    unnormalized = address.unnormalized_address.trim();
  } else if (trimmedUnnormalized.length) {
    unnormalized = trimmedUnnormalized;
  }
  if (!unnormalized.length) {
    return null;
  }

  const result = { unnormalized_address: unnormalized };
  const ensureField = (field, value) => {
    result[field] = value === undefined ? null : value;
  };

  for (const field of allowedFields) {
    let value = Object.prototype.hasOwnProperty.call(address, field)
      ? address[field]
      : null;

    if (value === undefined || value === null) {
      ensureField(field, null);
      continue;
    }

    if (typeof value === "string") {
      value = value.trim();
      if (!value.length) {
        ensureField(field, null);
        continue;
      }
    }

    switch (field) {
      case "latitude":
      case "longitude":
        ensureField(field, parseCoordinate(value));
        break;
      case "city_name": {
        const sanitized = sanitizeCityName(value);
        ensureField(field, sanitized || null);
        break;
      }
      case "state_code":
      case "country_code":
      case "street_pre_directional_text":
      case "street_post_directional_text":
        ensureField(field, String(value).trim().toUpperCase() || null);
        break;
      case "postal_code":
        ensureField(field, sanitizePostalCode(value) || null);
        break;
      case "plus_four_postal_code":
        ensureField(field, sanitizePlus4(value) || null);
        break;
      case "street_suffix_type": {
        const trimmed = String(value).trim();
        const mapped = mapStreetSuffixType(trimmed);
        ensureField(field, mapped || (trimmed.length ? trimmed : null));
        break;
      }
      case "street_name": {
        const trimmed = String(value).trim();
        ensureField(field, trimmed.length ? trimmed.toUpperCase() : null);
        break;
      }
      case "unit_identifier":
      case "route_number": {
        const trimmed = String(value).trim();
        ensureField(field, trimmed.length ? trimmed : null);
        break;
      }
      case "county_name":
      case "municipality_name": {
        const titled = toTitleCase(String(value));
        ensureField(field, titled && titled.trim().length ? titled : null);
        break;
      }
      case "township":
        ensureField(field, padGridValue(value, 2));
        break;
      case "range":
        ensureField(field, padGridValue(value, 2));
        break;
      case "section":
        ensureField(field, padGridValue(value, 2));
        break;
      case "block":
        ensureField(field, padGridValue(value, 3));
        break;
      case "lot":
        ensureField(field, padGridValue(value, 4));
        break;
      default:
        ensureField(field, value);
    }
  }

  if (result.state_code && !result.country_code) {
    result.country_code = "US";
  }

  if (
    !result.postal_code &&
    Object.prototype.hasOwnProperty.call(result, "plus_four_postal_code")
  ) {
    result.plus_four_postal_code = null;
  }

  if (
    Object.prototype.hasOwnProperty.call(result, "city_name") &&
    result.city_name &&
    /\d/.test(result.city_name)
  ) {
    result.city_name = sanitizeCityName(result.city_name) || null;
  }

  return result;
}

function filterRawAddressFields(address, options = {}) {
  if (!address || typeof address !== "object") return null;

  const allowedFields =
    Array.isArray(options.allowedFields) && options.allowedFields.length
      ? options.allowedFields
      : RAW_ADDRESS_ALLOWED_FIELDS;

  const unnormalized =
    typeof address.unnormalized_address === "string"
      ? address.unnormalized_address.trim()
      : "";
  if (!unnormalized.length) {
    return null;
  }

  const result = {
    unnormalized_address: unnormalized,
  };

  const GRID_NORMALIZATION = {
    township: 2,
    range: 2,
    section: 2,
    block: 3,
    lot: 4,
  };

  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(address, field)) continue;

    let value = address[field];
    if (value === undefined || value === null) continue;

    if (field === "latitude" || field === "longitude") {
      const numeric =
        typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(numeric)) continue;
      result[field] = numeric;
      continue;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      result[field] = value;
      continue;
    }

    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (!trimmed.length) continue;

    switch (field) {
      case "city_name": {
        const sanitized = sanitizeCityName(trimmed);
        if (sanitized) result[field] = sanitized;
        break;
      }
      case "postal_code": {
        const postal = sanitizePostalCode(trimmed);
        if (postal) result[field] = postal;
        break;
      }
      case "plus_four_postal_code": {
        const plus4 = sanitizePlus4(trimmed);
        if (plus4) result[field] = plus4;
        break;
      }
      case "state_code":
      case "country_code":
      case "street_pre_directional_text":
      case "street_post_directional_text":
        result[field] = trimmed.toUpperCase();
        break;
      case "street_suffix_type": {
        const mapped = mapStreetSuffixType(trimmed);
        if (mapped) {
          result[field] = mapped;
        } else {
          result[field] = trimmed;
        }
        break;
      }
      case "street_name":
        result[field] = trimmed.toUpperCase();
        break;
      case "unit_identifier":
      case "route_number":
        result[field] = trimmed;
        break;
      case "county_name":
      case "municipality_name": {
        const titled = toTitleCase(trimmed);
        if (titled && titled.trim().length) {
          result[field] = titled;
        }
        break;
      }
      default: {
        if (Object.prototype.hasOwnProperty.call(GRID_NORMALIZATION, field)) {
          const normalized = padGridValue(trimmed, GRID_NORMALIZATION[field]);
          if (normalized) {
            result[field] = normalized;
          }
        } else {
          result[field] = trimmed;
        }
        break;
      }
    }
  }

  if (result.state_code && !result.country_code) {
    result.country_code = "US";
  }
  if (
    !result.postal_code &&
    Object.prototype.hasOwnProperty.call(result, "plus_four_postal_code")
  ) {
    result.plus_four_postal_code = null;
  }

  return result;
}

function buildNormalizedAddressOutput(address) {
  if (!address || typeof address !== "object") return null;

  const result = {};
  for (const field of NORMALIZED_ADDRESS_FIELDS) {
    let value = Object.prototype.hasOwnProperty.call(address, field)
      ? address[field]
      : null;

    if (value === undefined || value === null) {
      result[field] = null;
      continue;
    }

    if (typeof value === "string") {
      value = value.trim();
      if (!value.length) {
        result[field] = null;
        continue;
      }
    }

    switch (field) {
      case "latitude":
      case "longitude":
        result[field] = parseCoordinate(value);
        break;
      case "city_name":
        result[field] = sanitizeCityName(value) || null;
        break;
      case "state_code":
      case "country_code":
      case "street_pre_directional_text":
      case "street_post_directional_text":
        result[field] = String(value).trim().toUpperCase() || null;
        break;
      case "postal_code":
        result[field] = sanitizePostalCode(value) || null;
        break;
      case "plus_four_postal_code":
        result[field] = sanitizePlus4(value) || null;
        break;
      case "street_suffix_type": {
        const trimmed = String(value).trim();
        const mapped = mapStreetSuffixType(trimmed);
        result[field] = mapped || (trimmed.length ? trimmed : null);
        break;
      }
      case "street_name": {
        const trimmed = String(value).trim();
        result[field] = trimmed.length ? trimmed.toUpperCase() : null;
        break;
      }
      case "unit_identifier":
      case "route_number": {
        const trimmed = String(value).trim();
        result[field] = trimmed.length ? trimmed : null;
        break;
      }
      case "county_name":
      case "municipality_name": {
        const titled = toTitleCase(String(value));
        result[field] = titled && titled.trim().length ? titled : null;
        break;
      }
      case "township":
        result[field] = padGridValue(value, 2);
        break;
      case "range":
        result[field] = padGridValue(value, 2);
        break;
      case "section":
        result[field] = padGridValue(value, 2);
        break;
      case "block":
        result[field] = padGridValue(value, 3);
        break;
      case "lot":
        result[field] = padGridValue(value, 4);
        break;
      default:
        result[field] = value;
    }
  }

  if (result.state_code && !result.country_code) {
    result.country_code = "US";
  }

  if (
    !result.postal_code &&
    Object.prototype.hasOwnProperty.call(result, "plus_four_postal_code")
  ) {
    result.plus_four_postal_code = null;
  }

  return result;
}

function buildRawAddressVariant(address, unnormalizedValue, options = {}) {
  const base =
    address && typeof address === "object" ? address : {};
  const trimmed =
    typeof unnormalizedValue === "string" ? unnormalizedValue.trim() : "";
  if (!trimmed.length) return null;

  const fallbackCounty =
    options && options.fallbackCounty ? options.fallbackCounty : null;
  const fallbackMunicipality =
    options && options.fallbackMunicipality ? options.fallbackMunicipality : null;

  const normalizedCounty = safeNullIfEmpty(base.county_name) || fallbackCounty;
  const normalizedMunicipality =
    safeNullIfEmpty(base.municipality_name) || fallbackMunicipality;

  const raw = {
    unnormalized_address: trimmed,
    latitude: parseCoordinate(base.latitude),
    longitude: parseCoordinate(base.longitude),
    city_name: sanitizeCityName(base.city_name) || null,
    state_code: base.state_code
      ? String(base.state_code).trim().toUpperCase() || null
      : null,
    postal_code: sanitizePostalCode(base.postal_code) || null,
    plus_four_postal_code: sanitizePlus4(base.plus_four_postal_code) || null,
    country_code: base.country_code
      ? String(base.country_code).trim().toUpperCase() || null
      : null,
    county_name: normalizedCounty ? toTitleCase(normalizedCounty) : null,
    municipality_name: normalizedMunicipality
      ? toTitleCase(normalizedMunicipality)
      : null,
    street_number: safeNullIfEmpty(base.street_number),
    street_name: (() => {
      if (!base.street_name) return null;
      const normalized =
        typeof base.street_name === "string"
          ? base.street_name.trim().toUpperCase()
          : base.street_name;
      return normalized && String(normalized).length ? normalized : null;
    })(),
    street_suffix_type: (() => {
      if (!base.street_suffix_type) return null;
      const mapped = mapStreetSuffixType(base.street_suffix_type);
      if (mapped) return mapped;
      if (typeof base.street_suffix_type === "string") {
        const trimmedSuffix = base.street_suffix_type.trim();
        return trimmedSuffix.length ? trimmedSuffix : null;
      }
      return null;
    })(),
    street_pre_directional_text: base.street_pre_directional_text
      ? String(base.street_pre_directional_text).trim().toUpperCase() || null
      : null,
    street_post_directional_text: base.street_post_directional_text
      ? String(base.street_post_directional_text).trim().toUpperCase() || null
      : null,
    unit_identifier: safeNullIfEmpty(base.unit_identifier),
    route_number: safeNullIfEmpty(base.route_number),
    township: padGridValue(base.township, 2),
    range: padGridValue(base.range, 2),
    section: padGridValue(base.section, 2),
    block: padGridValue(base.block, 3),
    lot: padGridValue(base.lot, 4),
  };

  if (!raw.country_code && raw.state_code) {
    raw.country_code = "US";
  }
  if (!raw.postal_code && Object.prototype.hasOwnProperty.call(raw, "plus_four_postal_code")) {
    raw.plus_four_postal_code = null;
  }

  return raw;
}

function normalizeParcelIdentifier(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  return digits.length ? digits : null;
}

function normalizeParcelIdentifierForFetch(value) {
  if (value === null || value === undefined) return null;
  const alphanumeric = String(value).replace(/[^0-9A-Za-z]/g, "");
  return alphanumeric.length ? alphanumeric : null;
}

function pickFirstParcelIdentifier(...candidates) {
  const queue = [...candidates];
  while (queue.length) {
    const candidate = queue.shift();
    if (Array.isArray(candidate)) {
      queue.unshift(...candidate);
      continue;
    }
    const normalized = normalizeParcelIdentifier(candidate);
    if (normalized) return normalized;
  }
  return null;
}

const MIDDLE_NAME_PLACEHOLDERS = new Set([
  "nmi",
  "n m i",
  "nm",
  "n m",
  "no",
  "none",
  "no middle",
  "no middle name",
  "no middle initial",
  "none recorded",
  "unknown",
  "na",
  "n/a",
  "no mn",
  "no mi",
]);

function parseModelJSONFromHTML(html) {
  const re = /var\s+model\s*=\s*(\{[\s\S]*?\});/m;
  const m = html.match(re);
  if (!m) return null;
  const jsonText = m[1];
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    try {
      return JSON.parse(jsonText.replace(/\n/g, ""));
    } catch (e2) {
      return null;
    }
  }
}

function mapDeedTypeEnum(s) {
  // Only return values that exactly map to the allowed enum list; else null.
  if (!s) return null;
  const t = s.toUpperCase().trim();
  if (t.includes("WARRANTY DEED")) return "Warranty Deed";
  if (t.includes("SPECIAL WARRANTY")) return "Special Warranty Deed";
  if (t.includes("QUIT")) return "Quitclaim Deed";
  if (t.includes("GRANT DEED")) return "Grant Deed";
  if (t.includes("BARGAIN AND SALE")) return "Bargain and Sale Deed";
  if (t.includes("LADY BIRD")) return "Lady Bird Deed";
  if (t.includes("TRANSFER ON DEATH")) return "Transfer on Death Deed";
  if (t.includes("SHERIFF'S DEED")) return "Sheriff's Deed";
  if (t.includes("TAX DEED")) return "Tax Deed";
  if (t.includes("TRUSTEE")) return "Trustee's Deed";
  if (t.includes("PERSONAL REPRESENTATIVE"))
    return "Personal Representative Deed";
  if (t.includes("CORRECTION")) return "Correction Deed";
  if (t.includes("LIEU")) return "Deed in Lieu of Foreclosure";
  if (t.includes("LIFE ESTATE")) return "Life Estate Deed";
  if (t.includes("JOINT TENANCY")) return "Joint Tenancy Deed";
  if (t.includes("TENANCY IN COMMON")) return "Tenancy in Common Deed";
  if (t.includes("COMMUNITY PROPERTY")) return "Community Property Deed";
  if (t.includes("GIFT DEED")) return "Gift Deed";
  if (t.includes("INTERSPOUSAL")) return "Interspousal Transfer Deed";
  if (t.includes("WILD DEED")) return "Wild Deed";
  return null;
}

function normalizeMiddleName(s) {
  const t = safeNullIfEmpty(s);
  if (t == null) return null;
  const cleaned = String(t)
    .replace(/[^A-Za-z\s\-',.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const canonical = cleaned
    .replace(/[',.]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (MIDDLE_NAME_PLACEHOLDERS.has(canonical)) return null;
  return formatNamePart(cleaned);
}

function toTitleCase(str) {
  if (!str || str.trim() === "") return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const PERSON_NAME_PATTERN = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

function formatNamePart(part) {
  if (!part) return null;
  let cleaned = String(part).trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/[^A-Za-z\s\-']/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  cleaned = cleaned
    .toLowerCase()
    .replace(/(^|[ \-'])([a-z])/g, (match, prefix, char) => `${prefix}${char.toUpperCase()}`);
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return PERSON_NAME_PATTERN.test(cleaned) ? cleaned : null;
}

async function main() {
  const dataDir = path.join("data");
  ensureDir(dataDir);

  const inputHTML = readText("input.html");
  const unAddr = readJSON("unnormalized_address.json");
  const seed = readJSON("property_seed.json");

  // Input owners/utilities/layout
  let ownersData = {};
  let utilitiesData = {};
  let layoutData = {};
  try {
    ownersData = readJSON(path.join("owners", "owner_data.json"));
  } catch (e) { }
  try {
    utilitiesData = readJSON(path.join("owners", "utilities_data.json"));
  } catch (e) { }
  try {
    layoutData = readJSON(path.join("owners", "layout_data.json"));
  } catch (e) { }

  const parcelIdCandidates = [];
  const parcelIdRawCandidates = [];
  const enqueueParcelCandidate = (value) => {
    const candidate = safeNullIfEmpty(value);
    if (!candidate) return;
    parcelIdCandidates.push(candidate);
    parcelIdRawCandidates.push(candidate);
  };

  if (seed && seed.parcel_id) enqueueParcelCandidate(seed.parcel_id);
  if (seed && seed.request_identifier)
    enqueueParcelCandidate(seed.request_identifier);
  if (
    seed &&
    seed.source_http_request &&
    seed.source_http_request.multiValueQueryString &&
    Array.isArray(seed.source_http_request.multiValueQueryString.parcelId)
  ) {
    for (const pid of seed.source_http_request.multiValueQueryString.parcelId) {
      enqueueParcelCandidate(pid);
    }
  }
  if (unAddr && unAddr.parcel_id) enqueueParcelCandidate(unAddr.parcel_id);
  if (unAddr && unAddr.request_identifier)
    enqueueParcelCandidate(unAddr.request_identifier);
  if (
    unAddr &&
    unAddr.source_http_request &&
    unAddr.source_http_request.multiValueQueryString &&
    Array.isArray(unAddr.source_http_request.multiValueQueryString.parcelId)
  ) {
    for (const pid of unAddr.source_http_request.multiValueQueryString.parcelId) {
      enqueueParcelCandidate(pid);
    }
  }

  let parcelId = null;
  let ownersKey = null;
  const initialLatitude = parseCoordinate(unAddr && unAddr.latitude);
  const initialLongitude = parseCoordinate(unAddr && unAddr.longitude);
  let parcelCentroid = null;

  // Parse embedded model first (robust source inside HTML)
  const model = parseModelJSONFromHTML(inputHTML);

  const modelDetail = model && model.propertyDetail ? model.propertyDetail : null;

  // Extract property core fields from HTML (supplement) with fallbacks to embedded model
  const addressLine1 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine1);
  const addressLine2 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine2);
  const addressLine3 = safeNullIfEmpty(modelDetail && modelDetail.AddressLine3);
  const hasStructuredAddressInput = Boolean(
    (addressLine1 && addressLine1.length) ||
      (addressLine2 && addressLine2.length) ||
      (addressLine3 && addressLine3.length),
  );

  const rawLocAddr = extractBetween(
    inputHTML,
    /<span id="MainContent_lblLocation">([\s\S]*?)<\/span>/i,
  );
  const siteLocationLine =
    safeNullIfEmpty(rawLocAddr) ||
    safeNullIfEmpty(modelDetail && modelDetail.Location) ||
    null;
  let municipality =
    safeNullIfEmpty(modelDetail && modelDetail.Municipality) ||
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /"AddressLine3":"([\w\s]+?)\s[A-Z]{2}\s\d{5}/i,
      ),
    );
  const pcnHyphen = safeNullIfEmpty(
    extractBetween(
      inputHTML,
      /<span id="MainContent_lblPCN">([\s\S]*?)<\/span>/i,
    ),
  );
  const subdivision =
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /<span id="MainContent_lblSubdiv">([\s\S]*?)<\/span>/i,
      ),
    ) || safeNullIfEmpty(modelDetail && modelDetail.Subdivision);
  const legalDesc =
    safeNullIfEmpty(
      extractBetween(
        inputHTML,
        /<span id="MainContent_lblLegalDesc">([\s\S]*?)<\/span>/i,
      ),
    ) || safeNullIfEmpty(modelDetail && modelDetail.LegalDesc);

  if (modelDetail && modelDetail.FormattedPCN) {
    enqueueParcelCandidate(modelDetail.FormattedPCN);
  }
  if (modelDetail && modelDetail.PCN) {
    enqueueParcelCandidate(modelDetail.PCN);
  }
  if (pcnHyphen) {
    enqueueParcelCandidate(pcnHyphen);
  }

  parcelId = pickFirstParcelIdentifier(parcelIdCandidates);
  ownersKey = parcelId ? `property_${parcelId}` : null;

  const parcelIdForCentroid = (() => {
    if (parcelId) {
      for (const rawCandidate of parcelIdRawCandidates) {
        const normalized = normalizeParcelIdentifier(rawCandidate);
        if (normalized && normalized === parcelId) {
          const canonical = normalizeParcelIdentifierForFetch(rawCandidate);
          if (canonical) {
            return canonical;
          }
        }
      }
    }
    for (const rawCandidate of parcelIdRawCandidates) {
      const canonical = normalizeParcelIdentifierForFetch(rawCandidate);
      if (canonical) {
        return canonical;
      }
    }
    if (parcelId) {
      return normalizeParcelIdentifierForFetch(parcelId);
    }
    return null;
  })();

  if (
    (!Number.isFinite(initialLatitude) || !Number.isFinite(initialLongitude)) &&
    (parcelIdForCentroid || parcelId) &&
    !parcelCentroid
  ) {
    const centroidParcelId = parcelIdForCentroid || parcelId;
    parcelCentroid = await fetchParcelCentroid(centroidParcelId);
  }

  // Property metrics from model.structuralDetails if available
  let areaUnderAir = null;
  let totalSquareFootage = null;
  let numberOfUnitsStr = null;
  let yearBuiltStr = null;
  let effectiveYearStr = null;
  let zoning = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Area Under Air/i.test(name)) areaUnderAir = val;
      if (/Total Square Footage/i.test(name)) totalSquareFootage = val;
      if (/Number of Units/i.test(name)) numberOfUnitsStr = val;
      if (/Dwelling Units/i.test(name)) numberOfUnitsStr = val;
      if (/Year Built/i.test(name)) yearBuiltStr = val;
      if (/Effective Year/i.test(name)) effectiveYearStr = val;
    }
  }
  // Zoning from model.propertyDetail if present
  if (model && model.propertyDetail) {
    const zc = model.propertyDetail.Zoning || null;
    const zd = model.propertyDetail.ZoningDesc || null;
    const zcitydesc = model.propertyDetail.ZoningCityDesc || null;
    if (zc && zd && zcitydesc) {
      zoning = `${zc}—${zd} (${zcitydesc})`;
    }
  }
  // Fallback to regex if missing
  if (!areaUnderAir) {
    const mA = inputHTML.match(
      /Area Under Air[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mA) areaUnderAir = mA[1];
  }
  if (!totalSquareFootage) {
    const mT = inputHTML.match(
      /Total Square Footage[\s\S]*?<td class=\"value\">\s*([\d.,]+)\s*<\/td>/i,
    );
    if (mT) totalSquareFootage = mT[1];
  }
  if (!numberOfUnitsStr) {
    const mN = inputHTML.match(
      /Number of Units[\s\S]*?<td class=\"value\">\s*(\d+)\s*<\/td>/i,
    );
    if (mN) numberOfUnitsStr = mN[1];
  }
  // Also try DWELLING UNITS pattern from building details
  if (!numberOfUnitsStr) {
    const mDU = inputHTML.match(
      /<b>DWELLING UNITS<\/b>-<i>(\d+)<\/i>/i,
    );
    if (mDU) numberOfUnitsStr = mDU[1];
  }
  if (!yearBuiltStr) {
    const mY = inputHTML.match(
      /Year Built[\s\S]*?<td class=\"value\">\s*(\d{4})\s*<\/td>/i,
    );
    if (mY) yearBuiltStr = mY[1];
  }
  // Also try Year Built from building header
  if (!yearBuiltStr) {
    const mYB = inputHTML.match(/Year Built:\s*(\d{4})/i);
    if (mYB) yearBuiltStr = mYB[1];
  }
  if (!effectiveYearStr) {
    const mEY = inputHTML.match(/Effective Year:\s*(\d{4})/i);
    if (mEY) effectiveYearStr = mEY[1];
  }
  if (!zoning) {
    const mZ = inputHTML.match(
      /<td class=\"label\">\s*Zoning\s*<\/td>\s*<td class=\"value\">\s*([\s\S]*?)<\/td>/i,
    );
    if (mZ) zoning = mZ[1].replace(/\s+/g, " ").trim();
  }

  // Helper function to clean and validate livable floor area
  function cleanLivableFloorArea(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^\d]/g, ''); // Remove all non-digits
    // Must have at least 2 consecutive digits to match schema pattern .*\d{2,}.*
    return cleaned.length >= 2 ? cleaned : null;
  }

  // Build property.json
  // property_type enum: LandParcel, Building, Unit, ManufacturedHome

  function propertyType(v) {
    if (!v) return null;
    const s = v.toUpperCase();

    // ManufacturedHome - mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("MHT COOP") || s.includes("MODULAR")) return "ManufacturedHome";

    // Unit - individual units within larger structures
    if (s.includes("CONDO") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("CO-OP") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") ||
        s.includes("BOAT UNITS") || s.includes("BOAT SLIPS") ||
        s.includes("LEASE INTEREST") || s.includes("NO LAND INTEREST")) return "Unit";

    // LandParcel - vacant land or land-focused properties
    if (s.includes("VACANT") || s.includes("ACREAGE") ||
        s.includes("AGRICULTURAL") || s.includes("PASTURE") ||
        s.includes("GROVE") || s.includes("TIMBER") || s.includes("FARM") ||
        s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("WETLANDS") || s.includes("PRESERVE") ||
        s.includes("CONSERVATION") || s.includes("RIGHT OF WAY")) return "LandParcel";

    // Building - default for structures (residential, commercial, industrial, institutional)
    return "Building";
  }

  function unitsType(v) {
    switch (v) {
      case "1":
        return "One";
      case "2":
        return "Two";
      case "3":
        return "Three";
      case "4":
        return "Four";
      default:
        return null;
    }
  }

  // Extract property type from HTML model
  let mappedPropertyType = null;
  let useCode = null;
  let units = null;

  const modelMatch = inputHTML.match(/var model = ({.*?});/s);
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (modelData.propertyDetail) {
        useCode =
          modelData.propertyDetail.UseCodeDesc ||
          modelData.propertyDetail.UseCode ||
          modelData.propertyDetail.PropertyUseCode ||
          modelData.propertyDetail.PropertyUseDescription ||
          null;
        mappedPropertyType = mapPropertyUseCodeToType(useCode);
        units = parseInt(modelData.propertyDetail.Units) || 0;
      }
    } catch (e) {
      console.log("Error parsing property type from model:", e.message);
    }
  }

  const property = {
    parcel_identifier:
      parcelId ||
      safeNullIfEmpty(pcnHyphen ? pcnHyphen.replace(/-/g, "") : null),
    property_structure_built_year: yearBuiltStr
      ? parseInt(yearBuiltStr, 10)
      : null,
    property_legal_description_text: safeNullIfEmpty(
      legalDesc ? legalDesc.replace(/\s+/g, " ").trim() : null,
    ),
    property_type: mappedPropertyType,
    property_usage_type: mapPropertyUsageType(useCode),
    livable_floor_area: cleanLivableFloorArea(areaUnderAir),
    number_of_units_type: null,
    number_of_units: units || (numberOfUnitsStr ? parseInt(numberOfUnitsStr, 10) : null),
    subdivision: safeNullIfEmpty(subdivision),
    zoning: safeNullIfEmpty(zoning),
    property_effective_built_year: effectiveYearStr
      ? parseInt(effectiveYearStr, 10)
      : null,
    historic_designation: false,
  };
  writeJSON(path.join(dataDir, "property.json"), property);

  // Lot.json - with allowed nulls and lot_size_acre
  let lotSizeAcre = null;
  // Prefer embedded model.propertyDetail.Acres
  if (
    model &&
    model.propertyDetail &&
    model.propertyDetail.Acres != null &&
    String(model.propertyDetail.Acres).trim() !== ""
  ) {
    const v = parseFloat(
      String(model.propertyDetail.Acres).replace(/[^0-9.]/g, ""),
    );
    if (!isNaN(v)) lotSizeAcre = v;
  }
  if (lotSizeAcre == null) {
    const acresMatch = inputHTML.match(
      /<td class=\"label\">\s*Acres[\s\S]*?<td class=\"value\">\s*([\d]*\.?\d+)\s*<\/td>/i,
    );
    if (acresMatch) {
      const v = parseFloat(acresMatch[1]);
      if (!isNaN(v)) lotSizeAcre = v;
    }
  }

  // Lot and block from legal description if present
  let lotNo = null,
    block = null;
  if (legalDesc) {
    const lotM =
      legalDesc.match(/\bLT\s*(\d+)/i) || legalDesc.match(/\bLOT\s*(\d+)/i);
    if (lotM) lotNo = lotM[1];
    const blkM =
      legalDesc.match(/\bBLK\s*(\w+)/i) || legalDesc.match(/\bBLOCK\s*(\w+)/i);
    if (blkM) block = blkM[1];
  }

  // Parse Section, Township, Range from Section Map Id (e.g., "05-1S-29-2")
  let section = null,
    township = null,
    range = null;
  const sectionMapMatch = inputHTML.match(
    /<b>Section Map Id:<\/b>[\s\S]*?<a[^>]*>(\d{2}-\d+[NS]-\d+(?:-\d+)?)<\/a>/i
  );
  if (sectionMapMatch) {
    const parts = sectionMapMatch[1].split("-");
    if (parts.length >= 3) {
      section = parts[0]; // "05"
      township = parts[1]; // "1S"
      range = parts[2]; // "29"
    }
  }

  if (
    (!section || !township || !range || !block || !lotNo) &&
    modelDetail &&
    modelDetail.FormattedPCN
  ) {
    const formatted = String(modelDetail.FormattedPCN).trim();
    if (formatted) {
      const parcelParts = formatted.split("-").map((part) => part.trim());
      if (parcelParts.length >= 4) {
        if (!township && parcelParts[1]) township = parcelParts[1];
        if (!range && parcelParts[2]) range = parcelParts[2];
        if (!section && parcelParts[3]) section = parcelParts[3];
      }
      if (!block && parcelParts.length >= 6 && parcelParts[5]) {
        block = parcelParts[5];
      }
      if (!lotNo && parcelParts.length >= 7 && parcelParts[6]) {
        lotNo = parcelParts[6];
      }
    }
  }

  const fullAddrInput = safeNullIfEmpty(unAddr && unAddr.full_address);
  const modelAddressLines = [addressLine1, addressLine2, addressLine3].filter(Boolean);
  const combinedModelAddress = combineAddressLines(modelAddressLines);

  const hasMeaningfulFullAddress = (value) =>
    !!value && /[A-Z]/i.test(value) && /\d/.test(value);

  const locationFullAddressCandidates = [
    safeNullIfEmpty(siteLocationLine),
    safeNullIfEmpty(modelDetail && modelDetail.Location),
    combinedModelAddress,
    fullAddrInput,
  ].filter(Boolean);

  const fullAddr =
    locationFullAddressCandidates.find((candidate) =>
      hasMeaningfulFullAddress(candidate),
    ) || locationFullAddressCandidates[0] || null;

  const unnormalizedAddressCandidate = (() => {
    const prioritized = [
      fullAddrInput,
      locationFullAddressCandidates.find((candidate) =>
        hasMeaningfulFullAddress(candidate),
      ),
      combinedModelAddress,
      siteLocationLine,
      fullAddr,
    ];
    for (const candidate of prioritized) {
      const normalizedCandidate = normalizeWhitespace(candidate);
      if (normalizedCandidate) return normalizedCandidate;
    }
    return null;
  })();
  const parsedUnnormalizedCityState = parseCityStatePostal(unnormalizedAddressCandidate);

  const tailSegments = [
    fullAddr && fullAddr.includes(",")
      ? fullAddr.split(",").slice(-1).join(" ")
      : fullAddr,
    siteLocationLine,
    combinedModelAddress,
    addressLine3,
    addressLine2,
    addressLine1,
    fullAddrInput,
  ].filter(Boolean);

  const cityStateCandidates = tailSegments.map((segment) =>
    parseCityStatePostal(segment),
  );

  const resolveField = (getter) => {
    for (const candidate of cityStateCandidates) {
      const value = getter(candidate);
      if (value) return value;
    }
    return null;
  };

  const resolvedCity = resolveField((c) => c.city);
  const resolvedState = resolveField((c) => c.state);
  const postalCode = resolveField((c) => c.postal);
  const plus4 = resolveField((c) => c.plus4);

  const countyName = safeNullIfEmpty(
    unAddr && unAddr.county_jurisdiction ? unAddr.county_jurisdiction : null,
  );
  const formattedCountyName = countyName ? titleCaseCounty(countyName) : null;
  const countyInferredStateCode = formattedCountyName ? "FL" : null; // Palm Beach data always targets Florida parcels
  const normalizedMunicipality = municipality
    ? municipality.replace(/\s+/g, " ").trim()
    : null;
  const normalizedCity = (() => {
    if (normalizedMunicipality) {
      const municipalityUpper = normalizedMunicipality.toUpperCase();
      if (!/\d/.test(municipalityUpper)) {
        return municipalityUpper;
      }
      const parsedMunicipality = parseCityStatePostal(normalizedMunicipality);
      if (parsedMunicipality.city) {
        const parsedUpper = parsedMunicipality.city.toUpperCase();
        if (!/\d/.test(parsedUpper)) {
          return parsedUpper;
        }
      }
    }
    if (resolvedCity) {
      const resolvedUpper = resolvedCity.toUpperCase();
      if (!/\d/.test(resolvedUpper)) {
        return resolvedUpper;
      }
    }
    return null;
  })();

  const rawStreetCandidates = [
    siteLocationLine,
    modelDetail && modelDetail.Location,
    addressLine1,
    addressLine2,
    combinedModelAddress,
    fullAddr,
    fullAddrInput,
  ];

  const splitStreetSegments = [];
  for (const candidate of rawStreetCandidates) {
    const cleaned = cleanStreetCandidate(candidate);
    if (cleaned) splitStreetSegments.push(cleaned);
    const raw = safeNullIfEmpty(candidate);
    if (raw && raw.includes(",")) {
      const first = raw.split(",")[0];
      const furtherClean = cleanStreetCandidate(first);
      if (furtherClean) splitStreetSegments.push(furtherClean);
    }
  }

  const streetCandidates = [];
  const seenStreet = new Set();
  for (const candidate of splitStreetSegments) {
    const normalized = normalizeWhitespace(candidate);
    if (!normalized) continue;
    const key = normalized.toUpperCase();
    if (
      (normalizedMunicipality &&
        key === normalizedMunicipality.toUpperCase()) ||
      (normalizedCity && key === normalizedCity)
    ) {
      continue;
    }
    if (seenStreet.has(key)) continue;
    seenStreet.add(key);
    streetCandidates.push(normalized);
  }

  const isLikelyStreetLine = (line) => {
    if (!line) return false;
    if (/\d/.test(line)) return true;
    return /\bLOT\b|\bBLK\b|\bBLOCK\b/i.test(line);
  };

  let locationLine = streetCandidates.find((candidate) =>
    isLikelyStreetLine(candidate),
  );
  if (!locationLine && streetCandidates.length) {
    locationLine = streetCandidates[0];
  }

  if (locationLine || normalizedCity || resolvedState || postalCode || unnormalizedAddressCandidate) {
    const locationLineForParsing = (() => {
      if (!locationLine) return locationLine;
      const firstSegment = locationLine.split(",")[0].trim();
      return firstSegment || locationLine;
    })();
    const parsedAddress = parseLocationAddress(locationLineForParsing);
    const resolvedStateUpper = resolvedState ? resolvedState.toUpperCase() : null;
    const inferredStateCode = countyInferredStateCode || resolvedStateUpper || null;
    const sanitizedPostalCode =
      sanitizePostalCode(postalCode) ||
      sanitizePostalCode(fullAddrInput) ||
      sanitizePostalCode(fullAddr);
    const sanitizedPlus4 =
      sanitizePlus4(plus4) ||
      sanitizePlus4(fullAddrInput) ||
      sanitizePlus4(fullAddr);
    const stateMismatch =
      countyInferredStateCode &&
      resolvedStateUpper &&
      resolvedStateUpper !== countyInferredStateCode;

    const address = ADDRESS_SCHEMA_FIELDS.reduce((acc, key) => {
      acc[key] = null;
      return acc;
    }, {});

    address.city_name = normalizedCity ? normalizedCity.toUpperCase() : null;
    if (address.city_name && /\d/.test(address.city_name)) {
      address.city_name = null;
    }
    address.county_name = safeNullIfEmpty(formattedCountyName);
    const resolvedLatitude =
      Number.isFinite(initialLatitude)
        ? initialLatitude
        : parcelCentroid && Number.isFinite(parcelCentroid.latitude)
          ? parcelCentroid.latitude
          : null;
    const resolvedLongitude =
      Number.isFinite(initialLongitude)
        ? initialLongitude
        : parcelCentroid && Number.isFinite(parcelCentroid.longitude)
          ? parcelCentroid.longitude
          : null;
    address.latitude = resolvedLatitude;
    address.longitude = resolvedLongitude;

    if (
      (!Number.isFinite(address.latitude) ||
        !Number.isFinite(address.longitude)) &&
      unnormalizedAddressCandidate
    ) {
      const geocodeResult = await geocodeAddress(
        unnormalizedAddressCandidate,
      );
      if (geocodeResult) {
        applyGeocodeEnhancements(address, geocodeResult);
      }
    }

    address.plus_four_postal_code = stateMismatch ? null : sanitizedPlus4;
    address.postal_code = stateMismatch ? null : sanitizedPostalCode;
    address.state_code = inferredStateCode;
    address.street_name = (() => {
      if (!parsedAddress.streetName) return null;
      const formatted = safeNullIfEmpty(formatStreetNameCase(parsedAddress.streetName));
      return formatted ? formatted.toUpperCase() : null;
    })();
    address.street_post_directional_text = safeNullIfEmpty(parsedAddress.streetPostDirectional);
    address.street_pre_directional_text = safeNullIfEmpty(parsedAddress.streetPreDirectional);
    address.street_number = safeNullIfEmpty(parsedAddress.streetNumber);
    address.street_suffix_type = safeNullIfEmpty(parsedAddress.streetSuffix);
    address.unit_identifier = safeNullIfEmpty(parsedAddress.unitIdentifier);
    address.route_number = safeNullIfEmpty(parsedAddress.routeNumber);
    if (!address.unit_identifier) {
      const unitFallback = extractUnitIdentifierFromAddressLines([
        addressLine1,
        addressLine2,
        locationLine,
      ]);
      if (unitFallback) address.unit_identifier = unitFallback;
    }
    address.township = safeNullIfEmpty(township);
    address.range = safeNullIfEmpty(range);
    address.section = safeNullIfEmpty(section);
    address.block = safeNullIfEmpty(block);
    address.lot = safeNullIfEmpty(lotNo);
    address.municipality_name = normalizedMunicipality
      ? toTitleCase(normalizedMunicipality)
      : null;
    if (parsedUnnormalizedCityState.city && !address.city_name) {
      const fallbackCity = sanitizeCityName(parsedUnnormalizedCityState.city);
      if (fallbackCity) {
        address.city_name = fallbackCity;
      }
    }
    if (parsedUnnormalizedCityState.state && !address.state_code) {
      const fallbackState = String(parsedUnnormalizedCityState.state).trim().toUpperCase();
      if (fallbackState.length) {
        address.state_code = fallbackState;
      }
    }
    if (parsedUnnormalizedCityState.postal && !address.postal_code) {
      const fallbackPostal = sanitizePostalCode(parsedUnnormalizedCityState.postal);
      if (fallbackPostal) {
        address.postal_code = fallbackPostal;
      }
    }
    if (parsedUnnormalizedCityState.plus4 && !address.plus_four_postal_code) {
      const fallbackPlus4 = sanitizePlus4(parsedUnnormalizedCityState.plus4);
      if (fallbackPlus4) {
        address.plus_four_postal_code = fallbackPlus4;
      }
    }
    if (!address.country_code && address.state_code) {
      address.country_code = "US";
    }
    const baseStreetCandidates = [
      locationLine,
      ...streetCandidates.filter((candidate) => candidate !== locationLine),
    ];
    const streetCandidatesForFallback = baseStreetCandidates
      .map((candidate) => safeNullIfEmpty(candidate))
      .filter(Boolean)
      .map((candidate) => {
        if (candidate.includes(",")) {
          const firstSegment = safeNullIfEmpty(candidate.split(",")[0]);
          return firstSegment || candidate.trim();
        }
        return candidate.trim();
      })
      .filter(
        (candidate, index, self) =>
          candidate && self.indexOf(candidate) === index,
      )
      .filter((candidate) => {
        const parsed = parseLocationAddress(candidate);
        return !!parsed.streetNumber;
      });

    const fallbackPcnSource =
      (modelDetail && modelDetail.FormattedPCN) || pcnHyphen || null;
    const fallbackPostalValue = stateMismatch ? null : sanitizedPostalCode;
    const fallbackPlus4Value = stateMismatch ? null : sanitizedPlus4;

    applyAddressFallbacks(address, {
      streetCandidates: streetCandidatesForFallback,
      fallbackCity: normalizedCity,
      fallbackState: inferredStateCode,
      fallbackPostal: fallbackPostalValue,
      fallbackPlus4: fallbackPlus4Value,
      municipality: normalizedMunicipality,
      county: formattedCountyName,
      formattedPcn: fallbackPcnSource,
      legalDescription: legalDesc,
    });

    enrichAddressFromUnnormalized(address, unnormalizedAddressCandidate);

    const prunedFields = pruneAddressComponentsForSchema(address);

    const normalizedSnapshot = { ...address };
    const fallbackUnnormalizedValue =
      unnormalizedAddressCandidate || composeUnnormalizedAddress(normalizedSnapshot);

    // Ensure every property is either a trimmed string or null
    for (const key of Object.keys(address)) {
      const value = address[key];
      if (value == null) {
        address[key] = null;
        continue;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        address[key] = trimmed.length ? trimmed : null;
      }
    }

    if (
      !address.country_code &&
      (address.state_code ||
        address.postal_code ||
        (formattedCountyName && formattedCountyName.length))
    ) {
      address.country_code = "US";
    }

    const GRID_FIELD_LENGTHS = {
      section: 2,
      township: 2,
      range: 2,
      block: 3,
      lot: 4,
    };
    for (const [field, length] of Object.entries(GRID_FIELD_LENGTHS)) {
      if (address[field]) {
        address[field] = padGridValue(address[field], length);
      }
    }

    const addressFilePath = path.join(dataDir, "address.json");
    const propertyAddressRelationshipPath = path.join(
      dataDir,
      "relationship_property_has_address.json",
    );
    const addressFactSheetRelationshipPath = path.join(
      dataDir,
      "relationship_address_has_fact_sheet.json",
    );

    for (const coordinateField of ADDRESS_REQUIRED_COORDINATE_FIELDS) {
      if (!Number.isFinite(address[coordinateField])) {
        address[coordinateField] = null;
      }
    }

    const trimmedUnnormalized =
      typeof fallbackUnnormalizedValue === "string"
        ? fallbackUnnormalizedValue.trim()
        : "";
    const hasUnnormalizedAddress = trimmedUnnormalized.length > 0;

    const normalizedAddressHasRequiredStrings = hasCompleteNormalizedAddress(address);
    const normalizedAddressHasSchemaCoverage =
      normalizedAddressHasRequiredStrings &&
      isNormalizedAddressSchemaReady(address);

    let finalAddress = null;
    let finalAddressVariant = null;
    let rawAddressCandidate = null;

    if (hasStructuredAddressInput && normalizedAddressHasSchemaCoverage) {
      const normalizedSeed = {
        ...collectAddressFields(address, NORMALIZED_ADDRESS_FIELDS, {
          preserveNulls: true,
        }),
      };
      const canonicalNormalized = buildNormalizedAddressOutput({
        ...normalizedSeed,
      });
      if (canonicalNormalized) {
        const ensuredNormalized = ensureAddressFieldsForOutput(
          canonicalNormalized,
          "normalized",
        );
        if (
          ensuredNormalized &&
          Object.prototype.hasOwnProperty.call(ensuredNormalized, "unnormalized_address")
        ) {
          delete ensuredNormalized.unnormalized_address;
        }
        finalAddress = ensuredNormalized;
        finalAddressVariant = "normalized";
      }
    }

    if (!finalAddress && hasUnnormalizedAddress) {
      rawAddressCandidate = buildRawAddressVariant(
        normalizedSnapshot,
        trimmedUnnormalized,
        {
          fallbackCounty: formattedCountyName,
          fallbackMunicipality: normalizedMunicipality,
        },
      );
      if (rawAddressCandidate) {
        finalAddress = rawAddressCandidate;
        finalAddressVariant = "raw";
      }
    }

    if (finalAddress && finalAddressVariant === "raw") {
      const candidateSources = [
        finalAddress,
        rawAddressCandidate,
        normalizedSnapshot,
        address,
      ].filter(Boolean);

      const pickValue = (field) => {
        for (const source of candidateSources) {
          if (
            source &&
            Object.prototype.hasOwnProperty.call(source, field)
          ) {
            const candidate = source[field];
            if (candidate === null || candidate === undefined) continue;
            if (typeof candidate === "string") {
              const trimmed = candidate.trim();
              if (!trimmed.length) continue;
              return trimmed;
            }
            if (typeof candidate === "number") {
              if (!Number.isFinite(candidate)) continue;
              return candidate;
            }
            return candidate;
          }
        }
        return null;
      };

      const pickCoordinate = (field) => {
        for (const source of candidateSources) {
          if (
            source &&
            Object.prototype.hasOwnProperty.call(source, field)
          ) {
            const numeric = parseCoordinate(source[field]);
            if (numeric != null) {
              return numeric;
            }
          }
        }
        return null;
      };

      const rawOutput = { ...finalAddress };

      if (trimmedUnnormalized.length) {
        rawOutput.unnormalized_address = trimmedUnnormalized;
      } else {
        const fallbackRaw = pickValue("unnormalized_address");
        if (typeof fallbackRaw === "string" && fallbackRaw.trim().length) {
          rawOutput.unnormalized_address = fallbackRaw.trim();
        }
      }

      const ensureCoordinate = (field) => {
        const numeric = pickCoordinate(field);
        rawOutput[field] = numeric != null ? numeric : null;
      };
      for (const coordinateField of ADDRESS_REQUIRED_COORDINATE_FIELDS) {
        ensureCoordinate(coordinateField);
      }

      const setField = (field, transform) => {
        const candidate = pickValue(field);
        if (candidate === null || candidate === undefined) return;
        let value =
          typeof transform === "function" ? transform(candidate) : candidate;
        if (value === null || value === undefined) return;

        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed.length) return;
          value = trimmed;
        } else if (typeof value === "number") {
          if (!Number.isFinite(value)) return;
        } else {
          const stringified = String(value).trim();
          if (!stringified.length) return;
          value = stringified;
        }

        rawOutput[field] = value;
      };

      setField("city_name", sanitizeCityName);
      setField("state_code", (value) => String(value).trim().toUpperCase());
      setField("postal_code", sanitizePostalCode);
      setField("county_name", toTitleCase);
      setField("country_code", (value) => String(value).trim().toUpperCase());

      const handledCoreFields = new Set([
        "city_name",
        "state_code",
        "postal_code",
        "county_name",
        "country_code",
        ...ADDRESS_REQUIRED_COORDINATE_FIELDS,
      ]);

      const optionalFields = RAW_ADDRESS_ALLOWED_FIELDS.filter(
        (field) =>
          !handledCoreFields.has(field) &&
          !RAW_SCHEMA_REQUIRED_FIELDS.includes(field),
      );

      for (const field of optionalFields) {
        if (
          Object.prototype.hasOwnProperty.call(rawOutput, field) &&
          rawOutput[field] !== undefined &&
          rawOutput[field] !== null
        ) {
          continue;
        }

        switch (field) {
          case "plus_four_postal_code":
            setField(field, sanitizePlus4);
            break;
          case "municipality_name":
            setField(field, toTitleCase);
            break;
          case "street_suffix_type":
            setField(field, (value) => {
              const mapped = mapStreetSuffixType(value);
              if (mapped) return mapped;
              if (typeof value === "string") {
                const trimmed = value.trim();
                return trimmed.length ? trimmed : null;
              }
              return value;
            });
            break;
          case "street_name":
            setField(field, (value) => {
              if (value == null) return null;
              const trimmed = String(value).trim();
              return trimmed.length ? trimmed.toUpperCase() : null;
            });
            break;
          case "street_pre_directional_text":
          case "street_post_directional_text":
            setField(field, (value) => {
              if (value == null) return null;
              const trimmed = String(value).trim().toUpperCase();
              return trimmed.length ? trimmed : null;
            });
            break;
          case "unit_identifier":
          case "route_number":
            setField(field, (value) => {
              if (value == null) return null;
              const trimmed = String(value).trim();
              return trimmed.length ? trimmed : null;
            });
            break;
          case "township":
          case "range":
            setField(field, (value) => padGridValue(value, 2));
            break;
          case "section":
            setField(field, (value) => padGridValue(value, 2));
            break;
          case "block":
            setField(field, (value) => padGridValue(value, 3));
            break;
          case "lot":
            setField(field, (value) => padGridValue(value, 4));
            break;
          default:
            setField(field);
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(rawOutput, "plus_four_postal_code") &&
        !rawOutput.postal_code
      ) {
        rawOutput.plus_four_postal_code = null;
      }
      if (rawOutput.state_code && !rawOutput.country_code) {
        rawOutput.country_code = "US";
      }

      const ensuredRaw = ensureRawAddressFieldCoverage(
        rawOutput,
        RAW_ADDRESS_ALLOWED_FIELDS,
      );
      const hasRawUnnormalized =
        ensuredRaw &&
        typeof ensuredRaw.unnormalized_address === "string" &&
        ensuredRaw.unnormalized_address.trim().length;

      if (hasRawUnnormalized) {
        ensuredRaw.unnormalized_address =
          ensuredRaw.unnormalized_address.trim();
        finalAddress = ensuredRaw;
      } else {
        finalAddress = null;
        finalAddressVariant = null;
      }
    } else if (finalAddress && finalAddressVariant === "normalized") {
      if (!finalAddress.country_code && finalAddress.state_code) {
        finalAddress.country_code = "US";
      }
      if (
        !finalAddress.postal_code &&
        Object.prototype.hasOwnProperty.call(finalAddress, "plus_four_postal_code")
      ) {
        finalAddress.plus_four_postal_code = null;
      }
    }

    if (finalAddress && finalAddressVariant === "raw") {
      const coverageReady =
        ensureRawAddressFieldCoverage(
          finalAddress,
          RAW_ADDRESS_OUTPUT_FIELDS,
        ) || finalAddress;
      const finalizedRaw = finalizeAddressForOutput(
        coverageReady,
        "raw",
        {
          allowedRawFields: RAW_ADDRESS_OUTPUT_FIELDS,
        },
      );
      if (finalizedRaw) {
        finalAddress = finalizedRaw;
      } else {
        finalAddress = coverageReady;
      }
      for (const field of RAW_ADDRESS_OUTPUT_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(finalAddress, field)) {
          finalAddress[field] = null;
        }
      }
      if (
        !Object.prototype.hasOwnProperty.call(finalAddress, "unnormalized_address") &&
        typeof trimmedUnnormalized === "string" &&
        trimmedUnnormalized.length
      ) {
        finalAddress.unnormalized_address = trimmedUnnormalized;
      }
    } else if (finalAddress && finalAddressVariant === "normalized") {
      const finalizedNormalized = finalizeAddressForOutput(
        finalAddress,
        "normalized",
      );
      if (finalizedNormalized) {
        finalAddress = finalizedNormalized;
      }
      finalAddress = ensureAddressFieldsForOutput(finalAddress, "normalized");
    }

    if (finalAddress && finalAddressVariant === "raw") {
      finalAddress =
        prepareAddressForSchema(finalAddress, "raw") || finalAddress;
    } else if (finalAddress && finalAddressVariant === "normalized") {
      finalAddress =
        prepareAddressForSchema(finalAddress, "normalized") || finalAddress;
    }

    if (finalAddress && finalAddressVariant === "raw") {
      const coverageReady = ensureRawAddressFieldCoverage(
        finalAddress,
        RAW_ADDRESS_OUTPUT_FIELDS,
      );
      if (coverageReady) {
        finalAddress = coverageReady;
      }

      for (const field of RAW_ADDRESS_OUTPUT_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(finalAddress, field)) {
          finalAddress[field] = null;
        }
      }

      const resolveUnnormalized = () => {
        if (
          Object.prototype.hasOwnProperty.call(finalAddress, "unnormalized_address") &&
          typeof finalAddress.unnormalized_address === "string"
        ) {
          const trimmed = finalAddress.unnormalized_address.trim();
          if (trimmed.length) {
            return trimmed;
          }
        }
        if (typeof trimmedUnnormalized === "string" && trimmedUnnormalized.length) {
          return trimmedUnnormalized;
        }
        if (
          rawAddressCandidate &&
          typeof rawAddressCandidate.unnormalized_address === "string" &&
          rawAddressCandidate.unnormalized_address.trim().length
        ) {
          return rawAddressCandidate.unnormalized_address.trim();
        }
        if (
          typeof fallbackUnnormalizedValue === "string" &&
          fallbackUnnormalizedValue.trim().length
        ) {
          return fallbackUnnormalizedValue.trim();
        }
        return "";
      };

      const resolvedUnnormalized = resolveUnnormalized();
      if (resolvedUnnormalized.length) {
        finalAddress.unnormalized_address = resolvedUnnormalized;
      } else {
        finalAddress = null;
        finalAddressVariant = null;
      }
    }

    if (finalAddress && finalAddressVariant === "raw") {
      const schemaAlignedRaw = buildRawSchemaAlignedAddress(finalAddress);
      if (schemaAlignedRaw) {
        finalAddress = ensureRawAddressSchemaDefaults(schemaAlignedRaw);
      } else {
        finalAddress = null;
        finalAddressVariant = null;
      }
    }

    if (finalAddress) {
      const schemaSurface = buildAddressSchemaSurface(finalAddress, finalAddressVariant, {
        trimmedUnnormalized,
        fallbackUnnormalized: fallbackUnnormalizedValue,
      });
      if (schemaSurface) {
        finalAddress = schemaSurface;
      } else {
        finalAddress = null;
        finalAddressVariant = null;
      }
    }

    if (finalAddress) {
      const normalizedTrimmedUnnormalized =
        typeof trimmedUnnormalized === "string" ? trimmedUnnormalized : "";
      const enforceVariant =
        finalAddressVariant === "normalized" || finalAddressVariant === "raw"
          ? finalAddressVariant
          : null;

      let schemaReadyAddress =
        enforceVariant !== null
          ? ensureAddressVariantIsSchemaCompliant(finalAddress, enforceVariant, {
              allowedRawFields: RAW_ADDRESS_OUTPUT_FIELDS,
            })
          : null;

      if (!schemaReadyAddress && hasUnnormalizedAddress) {
        const rawFallbackSeed = {
          ...collectAddressFields(address, RAW_ADDRESS_OUTPUT_FIELDS, {
            preserveNulls: true,
          }),
          unnormalized_address: normalizedTrimmedUnnormalized,
        };
        schemaReadyAddress = ensureAddressVariantIsSchemaCompliant(
          rawFallbackSeed,
          "raw",
          { allowedRawFields: RAW_ADDRESS_OUTPUT_FIELDS },
        );
        if (schemaReadyAddress) {
          finalAddressVariant = "raw";
        }
      }

      if (!schemaReadyAddress && enforceVariant === "normalized") {
        const normalizedFallbackSeed = collectAddressFields(
          address,
          NORMALIZED_ADDRESS_FIELDS,
          { preserveNulls: true },
        );
        schemaReadyAddress = ensureAddressVariantIsSchemaCompliant(
          normalizedFallbackSeed,
          "normalized",
        );
        if (schemaReadyAddress) {
          finalAddressVariant = "normalized";
        }
      }

      if (schemaReadyAddress) {
        const expectedFields =
          finalAddressVariant === "normalized"
            ? NORMALIZED_ADDRESS_FIELDS
            : RAW_ADDRESS_OUTPUT_FIELDS;

        for (const field of expectedFields) {
          if (!Object.prototype.hasOwnProperty.call(schemaReadyAddress, field)) {
            schemaReadyAddress[field] = null;
          }
        }

        if (finalAddressVariant === "raw") {
          if (
            !Object.prototype.hasOwnProperty.call(
              schemaReadyAddress,
              "unnormalized_address",
            ) &&
            normalizedTrimmedUnnormalized.length
          ) {
            schemaReadyAddress.unnormalized_address = normalizedTrimmedUnnormalized;
          }
        }

        for (const coordinateField of ADDRESS_REQUIRED_COORDINATE_FIELDS) {
          const numeric = parseCoordinate(schemaReadyAddress[coordinateField]);
          schemaReadyAddress[coordinateField] =
            numeric != null ? numeric : null;
        }

        if (
          schemaReadyAddress.state_code &&
          !schemaReadyAddress.country_code
        ) {
          schemaReadyAddress.country_code = "US";
        }
        if (
          Object.prototype.hasOwnProperty.call(
            schemaReadyAddress,
            "plus_four_postal_code",
          ) &&
          !schemaReadyAddress.postal_code
        ) {
          schemaReadyAddress.plus_four_postal_code = null;
        }

        finalAddress = schemaReadyAddress;
      } else {
        finalAddress = null;
        finalAddressVariant = null;
      }
    }

    const hasMeaningfulAddress =
      finalAddress &&
      Object.entries(finalAddress).some(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (typeof value === "string") {
          return value.trim().length > 0;
        }
        return true;
      });

    if (hasMeaningfulAddress && finalAddress) {
      writeJSON(addressFilePath, finalAddress);
      // Relationships are generated downstream; ensure no stale files remain.
      removeFileIfExists(propertyAddressRelationshipPath);
      removeFileIfExists(addressFactSheetRelationshipPath);
    } else {
      if (fs.existsSync(addressFilePath)) {
        fs.unlinkSync(addressFilePath);
      }
      removeFileIfExists(propertyAddressRelationshipPath);
      removeFileIfExists(addressFactSheetRelationshipPath);
    }

  }

  // Structure values primarily from model.structuralDetails
  let roofStructureVal = null,
    roofCoverVal = null,
    extWall1Val = null,
    extWall2Val = null,
    intWall1Val = null,
    intWall2Val = null,
    floorType1Val = null,
    floorType2Val = null,
    storiesVal = null,
    foundationVal = null,
    structuralFrameVal = null,
    heatAirVal = null;

  if (
    model &&
    model.structuralDetails &&
    Array.isArray(model.structuralDetails.StructuralElements)
  ) {
    for (const el of model.structuralDetails.StructuralElements) {
      const name = (el.ElementName || "").trim();
      const val = (el.ElementValue || "").toString().trim();
      if (/Roof Structure/i.test(name)) roofStructureVal = val;
      if (/Roof Cover/i.test(name)) roofCoverVal = val;
      if (/Exterior Wall 1/i.test(name)) extWall1Val = val;
      if (/Exterior Wall 2/i.test(name)) extWall2Val = val;
      if (/Interior Wall 1/i.test(name)) intWall1Val = val;
      if (/Interior Wall 2/i.test(name)) intWall2Val = val;
      if (/Floor Type 1/i.test(name)) floorType1Val = val;
      if (/Floor Type 2/i.test(name)) floorType2Val = val;
      if (/Stories/i.test(name)) storiesVal = val;
      if (/Foundation/i.test(name)) foundationVal = val;
      if (/Structural Frame/i.test(name)) structuralFrameVal = val;
      if (/Heat\/Air/i.test(name)) heatAirVal = val;
    }
  }
  // Fallback to regex when needed
  if (!roofStructureVal)
    roofStructureVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Structure\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!roofCoverVal)
    roofCoverVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Roof Cover\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall1Val)
    extWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!extWall2Val)
    extWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Exterior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall1Val)
    intWall1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!intWall2Val)
    intWall2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Interior Wall 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType1Val)
    floorType1Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 1\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!floorType2Val)
    floorType2Val = extractBetween(
      inputHTML,
      /<td class="label">\s*Floor Type 2\s*<\/td>\s*<td class="value">\s*([\s\S]*?)<\/td>/i,
    );
  if (!storiesVal)
    storiesVal = extractBetween(
      inputHTML,
      /<td class="label">\s*Stories\s*<\/td>\s*<td class="value">\s*(\d+)\s*<\/td>/i,
    );
  // Also try from building details patterns
  if (!foundationVal) {
    const mF = inputHTML.match(/<b>FOUNDATION<\/b>-<i>(.*?)<\/i>/i);
    if (mF) foundationVal = mF[1];
  }
  if (!structuralFrameVal) {
    const mSF = inputHTML.match(/<b>STRUCTURAL FRAME<\/b>-<i>(.*?)<\/i>/i);
    if (mSF) structuralFrameVal = mSF[1];
  }
  if (!storiesVal) {
    const mSt = inputHTML.match(/<b>NO\. STORIES<\/b>-<i>(\d+)<\/i>/i);
    if (mSt) storiesVal = mSt[1];
  }
  if (!heatAirVal) {
    const mHA = inputHTML.match(/<b>HEAT\/AIR<\/b>-<i>(.*?)<\/i>/i);
    if (mHA) heatAirVal = mHA[1];
  }

  function mapRoofDesign(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("GABLE") && s.includes("HIP")) return "Combination";
    if (s.includes("GABLE")) return "Gable";
    if (s.includes("HIP")) return "Hip";
    if (s.includes("FLAT")) return "Flat";
    return null;
  }
  function mapRoofCover(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("ASPHALT")) return "3-Tab Asphalt Shingle";
    if (s.includes("METAL")) return "Metal Standing Seam";
    if (s.includes("TILE")) return "Clay Tile";
    return null;
  }
  function mapExteriorWall(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("STUCCO")) return "Stucco";
    if (s.includes("BRICK")) return "Brick";
    if (s.includes("CONCRETE")) return "Concrete Block";
    return "Stucco";
  }
  function mapFlooring(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("CARPET")) return "Carpet";
    if (s.includes("TILE")) return "Ceramic Tile";
    if (s.includes("VINYL")) return "Sheet Vinyl";
    if (s.includes("WOOD")) return "Solid Hardwood";
    return null;
  }
  function mapInteriorWallSurface(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("DRYWALL")) return "Drywall";
    if (s.includes("PLASTER")) return "Plaster";
    return null;
  }
  function mapFoundationType(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("SLAB")) return "Slab";
    if (s.includes("CRAWL")) return "Crawl Space";
    if (s.includes("BASEMENT")) return "Full Basement";
    if (s.includes("PIER")) return "Pier and Beam";
    if (s.includes("PILING")) return "Piling";
    return null;
  }
  function mapFramingMaterial(v) {
    if (!v) return null;
    const s = v.toUpperCase();
    if (s.includes("WOOD")) return "Wood";
    if (s.includes("STEEL")) return "Steel";
    if (s.includes("CONCRETE")) return "Concrete";
    if (s.includes("MASONRY")) return "Masonry";
    return null;
  }
  function mapHVACSystem(heatAirValue) {
    // Parse HEAT/AIR field like "WALL/FLOOR FURN" to extract heating and cooling
    if (!heatAirValue) return { heating: null, cooling: null };
    const s = heatAirValue.toUpperCase();

    let heating = null;
    let cooling = null;

    // Heating system mappings
    if (s.includes("CENTRAL") && s.includes("GAS")) heating = "Forced Air";
    else if (s.includes("CENTRAL") || s.includes("FORCED AIR")) heating = "Forced Air";
    else if (s.includes("HEAT PUMP")) heating = "Heat Pump";
    else if (s.includes("ELECTRIC")) heating = "Electric";
    else if (s.includes("WALL") || s.includes("FLOOR") || s.includes("FURN")) heating = "Wall Furnace";
    else if (s.includes("BASEBOARD")) heating = "Electric Baseboard";
    else if (s.includes("RADIANT")) heating = "Radiant";
    else if (s.includes("NONE") || s.includes("NO HEAT")) heating = null;

    // Cooling system mappings
    if (s.includes("CENTRAL") && (s.includes("AIR") || s.includes("A/C") || s.includes("AC"))) cooling = "Central Air";
    else if (s.includes("HEAT PUMP")) cooling = "Heat Pump";
    else if (s.includes("WINDOW") || s.includes("WALL UNIT")) cooling = "Window Unit";
    else if (s.includes("NONE") || s.includes("NO A/C") || s.includes("NO AIR")) cooling = null;
    // If it mentions FURN (furnace) without AC, assume basic heating only
    else if (s.includes("FURN") && !s.includes("AIR") && !s.includes("A/C")) cooling = null;

    return { heating, cooling };
  }

  function mapElementNameToSpaceType(elementName) {
    if (!elementName) return null;
    const name = elementName.toUpperCase();

    // Skip summary elements that shouldn't be individual spaces
    if (
      name.includes("TOTAL SQUARE FOOTAGE") ||
      name.includes("AREA UNDER AIR")
    ) {
      return null; // Don't create layout items for these summary elements
    }

    if (name.includes("FOP") || name.includes("FINISHED OPEN PORCH"))
      return "Open Porch";
    if (name.includes("BAS") || name.includes("BASE AREA"))
      return "Living Area";
    if (name.includes("FGR") || name.includes("FINISHED GARAGE"))
      return "Attached Garage";
    if (name.includes("GARAGE")) return "Attached Garage";
    if (name.includes("PORCH")) return "Open Porch";
    if (name.includes("DECK")) return "Deck";
    if (name.includes("PATIO")) return "Patio";
    if (name.includes("BALCONY")) return "Balcony";
    if (name.includes("LIVING")) return "Living Area";
    if (name.includes("BEDROOM")) return "Bedroom";
    if (name.includes("BATH")) return "Bathroom";
    if (name.includes("KITCHEN")) return "Kitchen";
    if (name.includes("DINING")) return "Dining Room";
    if (name.includes("FAMILY")) return "Family Room";
    if (name.includes("LAUNDRY")) return "Laundry Room";
    if (name.includes("STORAGE")) return "Storage";
    if (name.includes("CLOSET")) return "Closet";
    if (name.includes("UTILITY")) return "Utility Room";
    if (name.includes("MECHANICAL")) return "Mechanical Room";
    if (name.includes("ELECTRICAL")) return "Electrical Room";
    if (name.includes("PLUMBING")) return "Plumbing Room";
    if (name.includes("HVAC")) return "HVAC Room";
    if (name.includes("HEATING")) return "Heating Room";
    if (name.includes("WATER")) return "Water Heater Room";
    if (name.includes("SEWER")) return "Sewer Room";
    if (name.includes("GAS")) return "Gas Room";
    if (name.includes("OTHER")) return "Other";

    return "Other"; // Default fallback
  }

  /**
   * Map Palm Beach Property Use Code to property_usage_type enum.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property usage type from Elephant schema enum
   */
  function mapPropertyUsageType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // RESIDENTIAL (0000-0900)
    if (s.includes("SINGLE FAMILY") || s.includes("DUPLEX") || s.includes("TRIPLEX") ||
        s.includes("MULTI-FAMILY") || s.includes("MOBILE HOME") || s.includes("CONDOMINIUM") ||
        s.includes("COOPERATIVE") || s.includes("APARTMENT") || s.includes("VACANT RESIDENTIAL") ||
        s.includes("INTERVAL OWNERSHIP") || s.includes("TIMESHARE") || s.includes("MISC RES"))
      return "Residential";

    // RETIREMENT
    if (s.includes("RETIREMENT HOME") || s.includes("HOME FOR THE AGED") || s.includes("NURSING HOME"))
      return "Retirement";

    // RESIDENTIAL COMMON ELEMENTS
    if (s.includes("RESIDENTIAL COMMON AREA") || s.includes("RESIDENTIAL COMMON AREA/ELEMENT"))
      return "ResidentialCommonElementsAreas";

    // COMMERCIAL - Retail
    if (s.includes("STORE") || s.includes("SUPERMARKET") || s.includes("CONVENIENCE STORE"))
      return "RetailStore";
    if (s.includes("DEPARTMENT STORE")) return "DepartmentStore";
    if (s.includes("SHOPPING CENTER, REGIONAL")) return "ShoppingCenterRegional";
    if (s.includes("SHOPPING CENTER, COMMUNITY") || s.includes("SHOPPING CENTER, NEIGHBORHOOD"))
      return "ShoppingCenterCommunity";

    // COMMERCIAL - Office
    if (s.includes("OFFICE BUILDING")) return "OfficeBuilding";
    if (s.includes("MEDICAL OFFICE")) return "MedicalOffice";

    // COMMERCIAL - Transportation
    if (s.includes("AIRPORT") || s.includes("BUS TERMINAL") || s.includes("MARINA"))
      return "TransportationTerminal";

    // COMMERCIAL - Food & Lodging
    if (s.includes("RESTAURANT")) return "Restaurant";
    if (s.includes("HOTEL") || s.includes("MOTEL")) return "Hotel";

    // COMMERCIAL - Financial
    if (s.includes("FINANCIAL INSTITUTION") || s.includes("INSURANCE COMPANY"))
      return "FinancialInstitution";

    // COMMERCIAL - Automotive
    if (s.includes("SERVICE STATION") || s.includes("VEHICLE LUBE")) return "ServiceStation";
    if (s.includes("AUTO SALES") || s.includes("GARAGE, REPAIR")) return "AutoSalesRepair";

    // COMMERCIAL - Entertainment
    if (s.includes("THEATRE") || s.includes("AUDITORIUM") || s.includes("NIGHT CLUB") ||
        s.includes("BAR") || s.includes("BOWLING ALLEY") || s.includes("SKATING") ||
        s.includes("TOURIST ATTRACTION") || s.includes("CAMPS"))
      return "Entertainment";
    if (s.includes("RACE TRACK")) return "RaceTrack";
    if (s.includes("GOLF COURSE")) return "GolfCourse";

    // COMMERCIAL - Other
    if (s.includes("MOBILE HOME PARK")) return "MobileHomePark";
    if (s.includes("WHOLESALER") || s.includes("PRODUCE HOUSE")) return "WholesaleOutlet";
    if (s.includes("PARKING LOT") || s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT"))
      return "Commercial";

    // INDUSTRIAL
    if (s.includes("LIGHT MANUFACTURING")) return "LightManufacturing";
    if (s.includes("HEAVY MANUFACTURING") || s.includes("EXCEPTIONAL INDUSTRIAL"))
      return "HeavyManufacturing";
    if (s.includes("LUMBER YARD")) return "LumberYard";
    if (s.includes("PACKING PLANT")) return "PackingPlant";
    if (s.includes("BOTTLER") || s.includes("FOOD PROCESSING")) return "Cannery";
    if (s.includes("MINERAL PROCESSING")) return "MineralProcessing";
    if (s.includes("WAREHOUSING")) return "Warehouse";
    if (s.includes("OPEN STORAGE") || s.includes("INDUSTRIAL, VACANT")) return "OpenStorage";

    // AGRICULTURAL
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("HAY"))
      return "DrylandCropland";
    if (s.includes("PASTURE")) return "GrazingLand";
    if (s.includes("TIMBER")) return "TimberLand";
    if (s.includes("GROVE") || s.includes("CITRUS") || s.includes("GRAPES")) return "OrchardGroves";
    if (s.includes("FOWL") || s.includes("BEES")) return "Poultry";
    if (s.includes("NURSERY") || s.includes("ORNAMENTAL")) return "Ornamentals";
    if (s.includes("HORSES") || s.includes("SWINE") || s.includes("GOATS") ||
        s.includes("AQUACULTURE") || s.includes("FISH") || s.includes("MISCELLANEOUS AG"))
      return "Agricultural";

    // INSTITUTIONAL - Church & Education
    if (s.includes("CHURCH")) return "Church";
    if (s.includes("SCHOOL, PRIVATE") || s.includes("DAY CARE") || s.includes("DORMITORY"))
      return "PrivateSchool";

    // INSTITUTIONAL - Healthcare
    if (s.includes("HOSPITAL, PRIVATE")) return "PrivateHospital";
    if (s.includes("SANITARIUM")) return "SanitariumConvalescentHome";

    // INSTITUTIONAL - Other
    if (s.includes("ORPHANAGE") || s.includes("MISC") && s.includes("INSTITUTIONAL"))
      return "NonProfitCharity";
    if (s.includes("MORTUARY") || s.includes("FUNERAL HOME") || s.includes("CEMETERY"))
      return "MortuaryCemetery";
    if (s.includes("LODGES") || s.includes("CLUBS") || s.includes("UNION HALLS") ||
        s.includes("YACHTING CLUBS") || s.includes("COUNTRY CLUBS"))
      return "ClubsLodges";
    if (s.includes("CULTURAL FACILITIES") || s.includes("PERFORMING ARTS"))
      return "CulturalOrganization";

    // GOVERNMENTAL
    if (s.includes("MILITARY FACILITY")) return "Military";
    if (s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR"))
      return "ForestParkRecreation";
    if (s.includes("GOVERNMENT OWNED, PUBLIC SCHOOL")) return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, COLLEGE") || s.includes("GOVERNMENT OWNED, UNIVERSITY"))
      return "PublicSchool";
    if (s.includes("GOVERNMENT OWNED, HOSPITAL")) return "PublicHospital";
    if (s.includes("COUNTY OWNED") || s.includes("STATE OWNED") ||
        s.includes("FEDERALLY OWNED") || s.includes("MUNICIPALLY OWNED") ||
        s.includes("VACANT GOVERNMENTAL"))
      return "GovernmentProperty";

    // UTILITIES & OTHER
    if (s.includes("UTILITIES") || s.includes("WATERWORKS") || s.includes("CENTRALLY ASSESSED"))
      return "Utility";
    if (s.includes("SUBMERGED") || s.includes("LAKE") || s.includes("POND") ||
        s.includes("RIVER") || s.includes("BAY BOTTOM"))
      return "RiversLakes";
    if (s.includes("SEWER DISP") || s.includes("SOLID WASTE") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("HAZARDOUS WASTE"))
      return "SewageDisposal";
    if (s.includes("RIGHT OF WAY") || s.includes("RAILROAD")) return "Railroad";

    // CONSERVATION & RECREATIONAL
    if (s.includes("CONSERVATION EASEMENT") || s.includes("MARKET VALUE CONSERVATION") ||
        s.includes("WETLANDS") || s.includes("PRESERVE") || s.includes("RESOURCE PROTECT") ||
        s.includes("ENDANGERED SPECIES") || s.includes("MANGROVE") || s.includes("MARSH LANDS") ||
        s.includes("SWAMP") || s.includes("CYPRESS HEAD"))
      return "Conservation";
    if (s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS"))
      return "Recreational";

    // Generic fallbacks
    if (s.includes("VACANT")) return "TransitionalProperty";

    return null;
  }

  /**
   * Map Palm Beach Property Use Code/description text to property_type.
   * New simplified enum: LandParcel, Building, Unit, ManufacturedHome
   * Handles residential, commercial, industrial, agricultural, institutional, and governmental properties.
   * @param {unknown} useCodeRaw
   * @returns {string|null} Property type from Elephant schema enum (LandParcel, Building, Unit, ManufacturedHome)
   */
  function mapPropertyUseCodeToType(useCodeRaw) {
    if (useCodeRaw == null) return null;
    const s = String(useCodeRaw).toUpperCase();

    // MANUFACTURED HOMES - Mobile homes and manufactured housing
    if (s.includes("MOBILE HOME") || s.includes("MANUFACTURED HOME") ||
        s.includes("RECREATIONAL VEHICLE PARK")) return "ManufacturedHome";

    // UNITS - Individual units within larger structures, condos, co-ops, timeshares, boat slips
    if (s.includes("CONDOMINIUM") || s.includes("CONDO") ||
        s.includes("CO-OPERATIVE") || s.includes("INTERVAL OWNERSHIP") ||
        s.includes("TIME SHARE") || s.includes("BOAT UNITS") ||
        s.includes("BOAT SLIPS") || s.includes("LEASE INTEREST") ||
        s.includes("NO LAND INTEREST")) return "Unit";

    // LAND PARCELS - Vacant land, agricultural, conservation, parking, water bodies, etc.
    if (s.includes("VACANT RESIDENTIAL") || s.includes("VACANT") ||
        s.includes("COMMERCIAL, VACANT") || s.includes("PROFESSIONAL, VACANT") ||
        s.includes("INDUSTRIAL, VACANT") || s.includes("VACANT INSTITUTIONAL") ||
        s.includes("VACANT GOVERNMENTAL")) return "LandParcel";

    // Agricultural land
    if (s.includes("FIELD CROP") || s.includes("VEGETABLES") || s.includes("POTATOES") ||
        s.includes("MISCELLANEOUS AG LAND") || s.includes("SOD") ||
        s.includes("TIMBER") || s.includes("PASTURE") || s.includes("GROVE") ||
        s.includes("GRAPES") || s.includes("CITRUS NURSERY") || s.includes("BEES") ||
        s.includes("FOWL") || s.includes("FISH") || s.includes("HORSES") ||
        s.includes("SWINE") || s.includes("GOATS") || s.includes("NURSERY") ||
        s.includes("AQUACULTURE") || s.includes("ACREAGE") ||
        s.includes("MARKET VALUE AGRICULTURAL")) return "LandParcel";

    // Open land and natural features
    if (s.includes("PARKING LOT") || s.includes("GOLF COURSE") ||
        s.includes("CEMETERY") || s.includes("OPEN STORAGE") ||
        s.includes("MINING") || s.includes("PETROLEUM") || s.includes("PHOSPHATE") ||
        s.includes("BOAT RAMPS") || s.includes("RIGHT OF WAY") ||
        s.includes("SUBMERGED") || s.includes("LOW LOT") || s.includes("LAKE") ||
        s.includes("POND") || s.includes("BAY BOTTOM") || s.includes("BORROW PIT") ||
        s.includes("WASTE LAND") || s.includes("SEWER DISP") ||
        s.includes("SOLID WASTE") || s.includes("HISTORICAL") ||
        s.includes("SLOUGH") || s.includes("INDIAN MOUND") ||
        s.includes("MARSH LANDS") || s.includes("ISLAND") || s.includes("SWAMP") ||
        s.includes("SPOILS EASEMENTS") || s.includes("ENDANGERED SPECIES") ||
        s.includes("MANGROVE") || s.includes("UNBUILDABLE") ||
        s.includes("RESOURCE PROTECT") || s.includes("WETLANDS") ||
        s.includes("PRESERVE") || s.includes("CYPRESS HEAD") ||
        s.includes("HAZARDOUS WASTE") || s.includes("MINERAL RIGHTS") ||
        s.includes("PARKS, PRIVATELY OWNED") || s.includes("RECREATIONAL AREAS") ||
        s.includes("MARKET VALUE CONSERVATION") || s.includes("CONSERVATION EASEMENT") ||
        s.includes("GOVERNMENT OWNED, FOREST") || s.includes("GOVERNMENT OWNED, PARK") ||
        s.includes("GOVERNMENT OWNED, RECREATIONAL") || s.includes("GOVERNMENT OWNED, OUTDOOR")) return "LandParcel";

    // BUILDINGS - All other structures (residential, commercial, industrial, institutional, governmental)
    // This is the default for most property types with structures
    return "Building";
  }

  // Extract number of buildings from HTML model
  let numberOfBuildings = 1; // Default to 1 building

  // Parse the JavaScript model from HTML to get building count
  if (modelMatch) {
    try {
      const modelData = JSON.parse(modelMatch[1]);
      if (
        modelData.structuralDetails &&
        modelData.structuralDetails.BuildingNumbers &&
        Array.isArray(modelData.structuralDetails.BuildingNumbers)
      ) {
        numberOfBuildings = modelData.structuralDetails.BuildingNumbers.length;
        console.log("Number of buildings extracted:", numberOfBuildings);
      }
    } catch (e) {
      console.log("Error parsing model data for building count:", e.message);
    }
  }

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: extWall1Val
      ? mapExteriorWall(extWall1Val) === "Concrete Block"
        ? "Concrete Block"
        : "Stucco"
      : null,
    exterior_wall_material_secondary: null,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: mapFlooring(floorType1Val),
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: mapInteriorWallSurface(intWall1Val),
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: mapRoofCover(roofCoverVal),
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: mapRoofDesign(roofStructureVal),
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: mapFoundationType(foundationVal),
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
    primary_framing_material: mapFramingMaterial(structuralFrameVal),
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: storiesVal ? parseInt(storiesVal, 10) : null,
    number_of_buildings: numberOfBuildings,
    finished_base_area: areaUnderAir ? parseInt(areaUnderAir, 10) : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // Utilities from owners/utilities_data.json or extracted from HTML
  const hvacSystems = mapHVACSystem(heatAirVal);
  let utilityOut = null;
  if (utilitiesData && ownersKey && utilitiesData[ownersKey]) {
    utilityOut = utilitiesData[ownersKey];
    // Override with extracted HVAC data if available
    if (hvacSystems.heating) utilityOut.heating_system_type = hvacSystems.heating;
    if (hvacSystems.cooling) utilityOut.cooling_system_type = hvacSystems.cooling;
  } else {
    utilityOut = {
      cooling_system_type: hvacSystems.cooling,
      heating_system_type: hvacSystems.heating,
      public_utility_type: null,
      sewer_type: null,
      water_source_type: null,
      plumbing_system_type: null,
      plumbing_system_type_other_description: null,
      electrical_panel_capacity: null,
      electrical_wiring_type: null,
      hvac_condensing_unit_present: null,
      electrical_wiring_type_other_description: null,
      solar_panel_present: false,
      solar_panel_type: null,
      solar_panel_type_other_description: null,
      smart_home_features: null,
      smart_home_features_other_description: null,
      hvac_unit_condition: null,
      solar_inverter_visible: false,
      hvac_unit_issues: null,
    };
  }
  writeJSON(path.join(dataDir, "utility.json"), utilityOut);

  // Generate layouts from extracted building data or fallback to owners/layout_data.json
  let layoutIdx = 1;

  // First, use extracted building data if available
  // Layout files are now created by the layout mapping script

  const lotOut = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    lot_size_acre: lotSizeAcre != null ? lotSizeAcre : null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lotOut);

  // Sales
  const salesFiles = [];
  if (model && Array.isArray(model.salesInfo)) {
    let sIdx = 1;
    for (const s of model.salesInfo) {
      const sale = {
        ownership_transfer_date: toISODate(s.SaleDate),
        purchase_price_amount: s.Price != null ? Number(s.Price) : null,
      };
      const p = path.join(dataDir, `sales_${sIdx}.json`);
      writeJSON(p, sale);
      salesFiles.push({
        index: sIdx,
        date: sale.ownership_transfer_date,
        rawDate: s.SaleDate,
        saleType: s.SaleType,
        Book: s.Book,
        Page: s.Page,
      });
      sIdx++;
    }
  }

  // Files for deed document references (from book/page data)
  const fileIndexBySale = new Map();
  let fileIdx = 1;
  function mapFileDocType(s) {
    if (!s) return "ConveyanceDeed";
    const t = s.toUpperCase();
    if (t.includes("WARRANTY DEED")) return "ConveyanceDeedWarrantyDeed";
    return "ConveyanceDeed";
  }
  for (const s of salesFiles) {
    if (s.Book && s.Page) {
      const book = String(s.Book).trim();
      const page = String(s.Page).trim();
      const fileObj = {
        file_format: "txt",
        name: `OR Book ${book} Page ${page}`,
        document_type: mapFileDocType(s.saleType),
      };
      writeJSON(path.join(dataDir, `file_${fileIdx}.json`), fileObj);
      fileIndexBySale.set(s.index, fileIdx);
      fileIdx++;
    }
  }

  // Deeds: create a deed file for each sale; deed_type only when enum-mappable
  const deedMap = new Map(); // map sales index -> deed index
  let deedIdx = 1;
  for (const s of salesFiles) {
    const dt = mapDeedTypeEnum(s.saleType);
    const deed = {};
    if (dt) deed.deed_type = dt;
    writeJSON(path.join(dataDir, `deed_${deedIdx}.json`), deed);
    deedMap.set(s.index, deedIdx);
    deedIdx++;
  }

  // relationship_deed_file (deed → file)
  let rdfIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    const fIndex = fileIndexBySale.get(sIndex);
    if (!fIndex) continue;
    writeRelationshipFile(
      path.join(dataDir, `relationship_deed_file_${rdfIdx}.json`),
      `./deed_${dIndex}.json`,
      `./file_${fIndex}.json`,
    );
    rdfIdx++;
  }

  // relationship_sales_deed (sales → deed)
  let relSDIdx = 1;
  for (const [sIndex, dIndex] of deedMap.entries()) {
    writeRelationshipFile(
      path.join(dataDir, `relationship_sales_deed_${relSDIdx}.json`),
      `./sales_${sIndex}.json`,
      `./deed_${dIndex}.json`,
    );
    relSDIdx++;
  }

  // Extract person and company names using improved classification
  let personIdx = 1;
  let companyIdx = 1;
  let relIdx = 1;
  const processedNames = new Set(); // Track processed names to avoid duplicates
  const propertyFilePath = path.join(dataDir, "property.json");
  const propertyFileExists = fs.existsSync(propertyFilePath);
  const propertyFileRelative = "./property.json";

  // Company detection keywords (case-insensitive)
  const companyRegex =
    /(\binc\b|\binc\.|\bllc\b|l\.l\.c\.|\bltd\b|\bltd\.\b|\bfoundation\b|\balliance\b|\bsolutions\b|\bcorp\b|\bcorp\.\b|\bco\b|\bco\.\b|\bcompany\b|\bservices\b|\btrust\b|\btr\b|\bassociates\b|\bpartners\b|\bholdings\b|\bgroup\b|\blp\b|\bpllc\b|\bpc\b|\bbank\b|\bna\b|n\.a\.)/i;

  function parseRawPersonName(raw) {
    const normalized = raw.replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();
    if (!normalized || !/[a-zA-Z]/.test(normalized)) return null;

    if (normalized.includes(",")) {
      const [lastPart, restPart] = normalized.split(",", 2);
      const restTokens = (restPart || "")
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!lastPart || restTokens.length === 0) return null;
      const first = restTokens.shift();
      const middle = restTokens.length ? restTokens.join(" ") : null;
      return { first, last: lastPart, middle };
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return null;
    const allUpper = tokens.every((t) => t === t.toUpperCase());
    const treatAsLastFirst =
      allUpper ||
      (tokens.slice(0, 2).every((t) => /^[A-Z]+$/.test(t)) &&
        tokens.some((t) => t === t.toUpperCase()));

    if (treatAsLastFirst) {
      const [last, first, ...middleParts] = tokens;
      const middle = middleParts.length ? middleParts.join(" ") : null;
      return { first, last, middle };
    }

    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const middle = tokens.slice(1, -1).join(" ") || null;
    return { first, last, middle };
  }

  function buildPersonFromRaw(raw) {
    const parsed = parseRawPersonName(raw);
    if (!parsed) return null;
    const firstName = formatNamePart(parsed.first);
    const lastName = formatNamePart(parsed.last);
    if (!firstName || !lastName) return null;
    const middleFormatted = normalizeMiddleName(parsed.middle);
    return {
      type: "person",
      first_name: firstName,
      last_name: lastName,
      middle_name: middleFormatted ?? null,
    };
  }

  function classifyRawToOwners(raw) {
    const normalized = raw.replace(/[.,]+/g, " ").replace(/\s+/g, " ").trim();

    if (!normalized || !/[a-zA-Z]/.test(normalized)) {
      return { owners: [], invalids: [{ raw, reason: "non_name" }] };
    }

    // Company classification: treat entire string as a single company
    if (companyRegex.test(normalized)) {
      return { owners: [{ type: "company", name: normalized }], invalids: [] };
    }

    // Multi-person split on '&'
    if (normalized.includes("&")) {
      const segments = normalized
        .split("&")
        .map((s) => s.trim())
        .filter(Boolean);
      const owners = [];
      const invalids = [];

      for (const seg of segments) {
        const person = buildPersonFromRaw(seg);
        if (!person) {
          invalids.push({ raw: seg, reason: "unparsed_person" });
          continue;
        }
        owners.push(person);
      }
      return { owners, invalids };
    }

    // Single person path
    const person = buildPersonFromRaw(normalized);
    if (!person) {
      return {
        owners: [],
        invalids: [{ raw: normalized, reason: "unparsed_person" }],
      };
    }
    return { owners: [person], invalids: [] };
  }

  // Extract from sales history
  if (model && Array.isArray(model.salesInfo)) {
    for (let i = 0; i < model.salesInfo.length; i++) {
      const sale = model.salesInfo[i];
      const saleIndex = i + 1;
      const saleFileRelative = `./sales_${saleIndex}.json`;
      const saleFilePath = path.join(dataDir, `sales_${saleIndex}.json`);
      const saleFileExists = fs.existsSync(saleFilePath);
      if (sale.OwnerName) {
        const ownerName = sale.OwnerName.trim();
        if (ownerName && !processedNames.has(ownerName)) {
          processedNames.add(ownerName);

          const { owners, invalids } = classifyRawToOwners(ownerName);

          for (const owner of owners) {
            if (owner.type === "company") {
              // Create company record
              const company = {
                name: toTitleCase(owner.name),
              };

              writeJSON(
                path.join(dataDir, `company_${companyIdx}.json`),
                company,
              );

              const companyFileRelative = `./company_${companyIdx}.json`;

              writeRelationshipFile(
                path.join(dataDir, `relationship_sales_company_${relIdx}.json`),
                saleFileExists ? saleFileRelative : null,
                companyFileRelative,
              );
              relIdx++;
              companyIdx++;
            } else {
              // Create person record
              const firstName = formatNamePart(owner.first_name);
              const lastName = formatNamePart(owner.last_name);
              if (!firstName || !lastName) {
                continue;
              }
              const middleName = normalizeMiddleName(owner.middle_name);
              const resolvedMiddleName = middleName ?? null;
              const person = {
                birth_date: null,
                first_name: firstName,
                last_name: lastName,
                middle_name: resolvedMiddleName,
                prefix_name: null,
                suffix_name: null,
                us_citizenship_status: null,
                veteran_status: null,
              };

              writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

              const personFileRelative = `./person_${personIdx}.json`;

              writeRelationshipFile(
                path.join(dataDir, `relationship_sales_person_${relIdx}.json`),
                saleFileExists ? saleFileRelative : null,
                personFileRelative,
              );
              relIdx++;
              personIdx++;
            }
          }
        }
      }
    }
  }

  // Also extract from current owner info if available
  if (model && Array.isArray(model.ownerInfo)) {
    for (const ownerName of model.ownerInfo) {
      if (ownerName && !processedNames.has(ownerName)) {
        processedNames.add(ownerName);

        const { owners, invalids } = classifyRawToOwners(ownerName);

        for (const owner of owners) {
          if (owner.type === "company") {
            // Create company record
            const company = {
              name: toTitleCase(owner.name),
            };

            writeJSON(
              path.join(dataDir, `company_${companyIdx}.json`),
              company,
            );

            const companyFileRelative = `./company_${companyIdx}.json`;

            writeRelationshipFile(
              path.join(
                dataDir,
                `relationship_company_${companyIdx}_property.json`,
              ),
              companyFileRelative,
              propertyFileExists ? propertyFileRelative : null,
            );
            companyIdx++;
          } else {
            // Create person record
            const firstName = formatNamePart(owner.first_name);
            const lastName = formatNamePart(owner.last_name);
            if (!firstName || !lastName) {
              continue;
            }
            const middleName = normalizeMiddleName(owner.middle_name);
            const resolvedMiddleName = middleName ?? null;
            const person = {
              birth_date: null,
              first_name: firstName,
              last_name: lastName,
              middle_name: resolvedMiddleName,
              prefix_name: null,
              suffix_name: null,
              us_citizenship_status: null,
              veteran_status: null,
            };

            writeJSON(path.join(dataDir, `person_${personIdx}.json`), person);

            const personFileRelative = `./person_${personIdx}.json`;

            writeRelationshipFile(
              path.join(
                dataDir,
                `relationship_person_${personIdx}_property.json`,
              ),
              personFileRelative,
              propertyFileExists ? propertyFileRelative : null,
            );
            personIdx++;
          }
        }
      }
    }
  }

  // Taxes
  if (model) {
    const assessByYear = new Map();
    const appraiseByYear = new Map();
    const taxByYear = new Map();
    if (Array.isArray(model.assessmentInfo)) {
      for (const a of model.assessmentInfo)
        assessByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.appraisalInfo)) {
      for (const a of model.appraisalInfo)
        appraiseByYear.set(String(a.TaxYear), a);
    }
    if (Array.isArray(model.taxInfo)) {
      for (const a of model.taxInfo) taxByYear.set(String(a.TaxYear), a);
    }
    const years = new Set([
      ...assessByYear.keys(),
      ...appraiseByYear.keys(),
      ...taxByYear.keys(),
    ]);
    for (const y of Array.from(years).sort()) {
      const ass = assessByYear.get(y) || {};
      const appr = appraiseByYear.get(y) || {};
      const tax = taxByYear.get(y) || {};
      const landVal = appr.LandValue != null ? Number(appr.LandValue) : null;
      const bldVal =
        appr.ImprovementValue != null ? Number(appr.ImprovementValue) : null;
      const assessed =
        ass.AssessedValue != null ? Number(ass.AssessedValue) : null;
      const market =
        appr.TotalMarketValue != null ? Number(appr.TotalMarketValue) : null;
      const taxable =
        ass.TaxableValue != null ? Number(ass.TaxableValue) : null;
      const yearly =
        tax.TotalTaxValue != null ? Number(tax.TotalTaxValue) : null;
      const taxObj = {
        tax_year: y ? parseInt(y, 10) : null,
        property_assessed_value_amount: assessed,
        property_market_value_amount: market,
        property_building_amount: bldVal,
        property_land_amount: landVal && landVal > 0 ? landVal : null,
        property_taxable_value_amount: taxable,
        monthly_tax_amount: null,
        period_start_date: null,
        period_end_date: null,
        yearly_tax_amount: yearly,
      };
      writeJSON(path.join(dataDir, `tax_${y}.json`), taxObj);
    }
  }

  // Run mapping scripts to generate additional data files
  console.log("Running owner mapping...");
  require("./ownerMapping.js");

  console.log("Running layout mapping...");
  require("./layoutMapping.js");

  console.log("Running structure mapping...");
  require("./structureMapping.js");

  console.log("Running utility mapping...");
  require("./utilityMapping.js");

  console.log("All mapping scripts completed successfully");
}

main().catch((error) => {
  console.error("Fatal error during data extraction:", error);
  process.exitCode = 1;
});
