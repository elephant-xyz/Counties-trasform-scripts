  };
  let suffix = null;
  if (tokens.length > 1) {
    const rawSuffix = tokens[tokens.length - 1];
    const rawUpper = (rawSuffix || "").toUpperCase();
    if (suffixMap[rawUpper]) {
      suffix = suffixMap[rawUpper];
      tokens = tokens.slice(0, -1); // remove suffix from street_name tokens
    }
  }
  const streetName = tokens.join(" ").toUpperCase();
  return { streetName, preDir, postDir, suffix };
}

function parseAddress(
  fullAddress,
  legalText,
  section,
  township,
  range,
  countyNameFromSeed,
  municipality,
) {
  // Example fullAddress: 280 S COLLIER BLVD # 2306, MARCO ISLAND 34145
  let streetNumber = null,
    streetName = null,
    postDir = null,
    preDir = null,
    suffixType = null,
    city = null,
    state = null,
    zip = null,
    unitId = null;

  if (fullAddress) {
    const addr = fullAddress.replace(/\s+,/g, ",").trim();

    // First, extract unit identifier if present (# 2306, APT 2306, UNIT 2306, etc.)
    let streetPartRaw = addr;
    const unitMatch = addr.match(/(#|APT|UNIT|STE|SUITE)\s*([A-Z0-9-]+)/i);
    if (unitMatch) {
      unitId = unitMatch[2];
      // Remove unit from address for further parsing
      streetPartRaw = addr.replace(/(#|APT|UNIT|STE|SUITE)\s*[A-Z0-9-]+/i, "").trim();
    }

    // Prefer pattern: <num> <street words> [<postDir>], <CITY>, <STATE> <ZIP>
    let m = streetPartRaw.match(
      /^(\d+)\s+([^,]+),\s*([A-Z\s]+),\s*([A-Z]{2})\s*(\d{5})(?:-\d{4})?$/,
    );
    if (m) {
      streetNumber = m[1];
      const streetPart = m[2].trim();
      city = m[3].trim().toUpperCase();
      state = m[4];
      zip = m[5];
      const parsed = splitStreet(streetPart);
      streetName = parsed.streetName;
      preDir = parsed.preDir;
      postDir = parsed.postDir;
      suffixType = parsed.suffix;
    } else {
      // Fallback pattern without explicit state: <num> <street words> [<postDir>], <CITY> <ZIP>
      m = streetPartRaw.match(/^(\d+)\s+([^,]+),\s*([A-Z\s]+)\s*(\d{5})(?:-\d{4})?$/);
      if (m) {
        streetNumber = m[1];
        const streetPart = m[2].trim();
        city = m[3].trim().toUpperCase();
        zip = m[4];
        const parsed = splitStreet(streetPart);
        streetName = parsed.streetName;
        preDir = parsed.preDir;
        postDir = parsed.postDir;
        suffixType = parsed.suffix;
      }
    }
  }

  // From legal, get block and lot
  let block = null,
    lot = null;
  if (legalText) {
    const b = legalText.match(/BLOCK\s+([A-Z0-9]+)/i);
    if (b) block = b[1].toUpperCase();
    const l = legalText.match(/LOT\s+(\w+)/i);
    if (l) lot = l[1];
  }

  return {
    block: block || null,
    city_name: city || null,
    country_code: null, // do not fabricate
    county_name: countyNameFromSeed || null,
    latitude: null,
    longitude: null,
    lot: lot || null,
    municipality_name: municipality || null,
    plus_four_postal_code: null,
    postal_code: zip || null,
    range: range || null,
    route_number: null,
    section: section || null,
    state_code: state || "FL",
    street_name: streetName || null,
    street_number: streetNumber || null,
    street_post_directional_text: postDir || null,
    street_pre_directional_text: preDir || null,
    street_suffix_type: suffixType || null,
    township: township || null,
    unit_identifier: unitId || null,
    // unnormalized_address: fullAddress || null,
  };
}

function main() {
  const inHtmlPath = path.join("input.html");
  const unaddrPath = path.join("unnormalized_address.json");
  const seedPath = path.join("property_seed.json");
  const ownersPath = path.join("owners", "owner_data.json");
  const utilsPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const html = fs.readFileSync(inHtmlPath, "utf8");
  const $ = cheerio.load(html);

  const unaddr = readJson(unaddrPath);
  const seed = readJson(seedPath);
  const owners = readJson(ownersPath);
  const utils = readJson(utilsPath);
  const layouts = readJson(layoutPath);

  const dataDir = path.join(".", "data");
  ensureDir(dataDir);

  const folio = seed.request_identifier || seed.parcel_id;

  // Extract base fields from HTML
  const parcelId =
    $("#ParcelID").first().text().trim() || seed.parcel_id || folio;
  const fullAddressHtml = $("#FullAddressUnit").first().text().trim();
  const fullAddressUn = unaddr.full_address || null;
  const fullAddress = fullAddressUn || fullAddressHtml || null;
  const legalText = $("#Legal").first().text().trim() || null;
  const subdivisionRaw = $("#SCDescription").first().text().trim() || null; // e.g., 469900 - LONGSHORE LAKE UNIT 1
  const subdivision = subdivisionRaw
    ? subdivisionRaw.replace(/^\s*\d+\s*-\s*/, "").trim()
    : null;
  const useCodeText = $("#UCDescription").first().text().trim();

  const section = $("#Section").first().text().trim() || null;
