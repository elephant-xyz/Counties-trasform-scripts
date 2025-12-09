// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadExtraFeatureDescriptions() {
  const extraFeaturesPath = path.resolve(__dirname, "..", "extra_features");
  let contents = "";
  try {
    contents = fs.readFileSync(extraFeaturesPath, "utf8");
  } catch (err) {
    return {};
  }
  const descriptions = {};
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || !line.includes("\t")) return;
    const [rawCode, rawDescription] = line.split("\t");
    const code = rawCode.trim();
    if (!code || code.toLowerCase() === "code") return;
    const description = rawDescription ? rawDescription.trim() : null;
    descriptions[code] = description;
  });
  return descriptions;
}

const ADDITIONAL_DESCRIPTIONS = {
  BASAD: "Additional BAS segment",
  CARSTOP: "Car Stops",
  CS: "Concrete Slab (display only)",
  CSC: "Concrete Slab With Covering",
  CURB: "Curbing",
  "CURB WG": "Curbing with Gutter",
  "GAR C": "Garage Concrete",
  "LT MV1": "Light Mercury Vapor 100w",
  "LTPO CONC": "Light Pole Concrete",
  "PAV ASP": "Paving Asphalt",
  "PAV CON": "Paving Concrete",
  POOL: "Swimming Pool",
  "POOL LG": "Pool Gunite Over 800 SF",
  "SLAB C": "Slab Concrete",
  "SLAB K": "Keystone Slab",
  VADD: "Vinyl Addition",
  "WALL CBS": "Wall Concrete Block Stucco",
  "WDOP WS": "Woodframe Open Porch with Slab",
  WDOPS: "Wood Open Porch with Slab",
};

const DEFAULT_MAPPING = {
  space_type: "Building",
  is_exterior: false,
  is_finished: null,
};

const extraDescriptions = loadExtraFeatureDescriptions();
const combinedDescriptions = {
  ...extraDescriptions,
  ...ADDITIONAL_DESCRIPTIONS,
};

const subAreaMap = new Map();
const defaultedSubAreas = new Set();

function setSubAreaMapping(codes, mapping) {
  codes.forEach((code) => {
    subAreaMap.set(code, {
      space_type: mapping.space_type,
      is_exterior:
        Object.prototype.hasOwnProperty.call(mapping, "is_exterior") ?
          Boolean(mapping.is_exterior) :
          DEFAULT_MAPPING.is_exterior,
      is_finished:
        Object.prototype.hasOwnProperty.call(mapping, "is_finished") ?
          (mapping.is_finished == null ? null : Boolean(mapping.is_finished)) :
          DEFAULT_MAPPING.is_finished,
    });
  });
}

setSubAreaMapping(["AOF", "FOF", "GOF"], {
  space_type: "Office Room",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(
  [
    "APT",
    "BAS",
    "BASAD",
    "FHS",
    "FUS",
    "FWO",
    "OHA",
    "OHB",
    "OWA",
    "OWH",
    "STF",
    "STP",
    "TWB",
    "TWO",
    "VADD",
  ],
  {
    space_type: "Living Area",
    is_exterior: false,
    is_finished: true,
  },
);

setSubAreaMapping(["SFB", "UUS", "ONE"], {
  space_type: "Living Area",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(["BRS"], {
  space_type: "Bar Area",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["CAN", "CDN", "FOP", "WDOP WS", "WDOPS"], {
  space_type: "Open Porch",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UOP"], {
  space_type: "Open Porch",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["CLP"], {
  space_type: "Porch",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["ULP"], {
  space_type: "Porch",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FSP", "FDS", "SPV"], {
  space_type: "Screened Porch",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["USP", "UDS"], {
  space_type: "Screened Porch",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FEP"], {
  space_type: "Enclosed Porch",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UEP"], {
  space_type: "Enclosed Porch",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FCP"], {
  space_type: "Attached Carport",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UCP"], {
  space_type: "Attached Carport",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FDC"], {
  space_type: "Detached Carport",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UDC"], {
  space_type: "Detached Carport",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["CARSTOP"], {
  space_type: "Carport",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FGR", "GAR C"], {
  space_type: "Attached Garage",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["UGR"], {
  space_type: "Attached Garage",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(["FDG"], {
  space_type: "Detached Garage",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["UDG"], {
  space_type: "Detached Garage",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(["FCB"], {
  space_type: "Enclosed Cabana",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UCB"], {
  space_type: "Enclosed Cabana",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FDU"], {
  space_type: "Detached Utility Closet",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["UDU"], {
  space_type: "Detached Utility Closet",
  is_exterior: true,
  is_finished: false,
});

setSubAreaMapping(["FST"], {
  space_type: "Storage Room",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["UST"], {
  space_type: "Storage Room",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(["FAT"], {
  space_type: "Attic",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["DMR"], {
  space_type: "Attic",
  is_exterior: false,
  is_finished: null,
});

setSubAreaMapping(["FBM"], {
  space_type: "Basement",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["UBM"], {
  space_type: "Basement",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(["KTA", "KTG"], {
  space_type: "Kitchen",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["LBA", "LBG"], {
  space_type: "Lobby / Entry Hall",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["CSA", "DCK", "SDF"], {
  space_type: "Common Room",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["SPN"], {
  space_type: "Plant Floor",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["FLR", "MEF"], {
  space_type: "Floor",
  is_exterior: false,
  is_finished: true,
});

setSubAreaMapping(["MEU"], {
  space_type: "Floor",
  is_exterior: false,
  is_finished: false,
});

setSubAreaMapping(
  ["PTO", "CS", "CSC", "PAV ASP", "PAV CON", "CURB", "CURB WG", "SLAB C", "SLAB K"],
  {
    space_type: "Patio",
    is_exterior: true,
    is_finished: true,
  },
);

setSubAreaMapping(["POOL", "POOL LG"], {
  space_type: "Outdoor Pool",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["SPA"], {
  space_type: "Pool Area",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["SDA"], {
  space_type: "Screen Enclosure (Custom)",
  is_exterior: true,
  is_finished: true,
});

setSubAreaMapping(["LT MV1", "LTPO CONC", "WALL CBS", "PTR"], {
  space_type: "Building",
  is_exterior: true,
  is_finished: null,
});

Object.keys(combinedDescriptions).forEach((code) => {
  if (!subAreaMap.has(code)) {
    subAreaMap.set(code, { ...DEFAULT_MAPPING });
    defaultedSubAreas.add(code);
  }
});

function mapSubAreaCode(code, overrideDescription) {
  if (!code) return null;
  const normalized = String(code).trim();
  if (!normalized) return null;
  if (!subAreaMap.has(normalized)) {
    subAreaMap.set(normalized, { ...DEFAULT_MAPPING });
    defaultedSubAreas.add(normalized);
  }
  const mapping = subAreaMap.get(normalized);
  return {
    code: normalized,
    description:
      overrideDescription ||
      combinedDescriptions[normalized] ||
      extraDescriptions[normalized] ||
      null,
    space_type: mapping.space_type,
    is_exterior: mapping.is_exterior,
    is_finished: mapping.is_finished,
    matched: !defaultedSubAreas.has(normalized),
  };
}

function getDefaultedSubAreaCodes() {
  return Array.from(defaultedSubAreas).sort();
}

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const BUILDING_SECTION_TITLE = "Building Information";

function textTrim(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function getParcelId($) {
  let parcelIdText = $(PARCEL_SELECTOR).text().trim();
  if (parcelIdText) {
    return parcelIdText;
  }
  return null;
}

function collectBuildings($) {
  const buildings = [];
  const section = $("section")
    .filter(
      (_, s) =>
        textTrim($(s).find(".module-header .title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();
  if (!section.length) return buildings;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataLeftColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) buildings.push(map);
    });
  let buildingCount = 0;
  $(section)
    .find(
      '.two-column-blocks > div[id$="_dynamicBuildingDataRightColumn_divSummary"]',
    )
    .each((_, div) => {
      const map = {};
      $(div)
        .find("table tbody tr")
        .each((__, tr) => {
          let label = textTrim($(tr).find("td strong").first().text());
          if (!label || !label.trim()) {
            label = textTrim($(tr).find("th strong").first().text());
          }
          const value = textTrim($(tr).find("td span").first().text());
          if (label) map[label] = value;
        });
      if (Object.keys(map).length) {
        const combined_map = {...buildings[buildingCount], ...map};
        buildings[buildingCount++] = combined_map;
      };
    });
  return buildings;
}

function parseSquareFeet(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function collectSubAreaDetails($) {
  const perBuilding = [];
  const fallbackCodes = new Set();
  $("#ctlBodyPane_ctl09_mSection table[id*='lstSubAreaSqFt']").each(
    (index, table) => {
      const entries = [];
      $(table)
        .find("tbody tr")
        .each((_, tr) => {
          const code = textTrim($(tr).find('th[scope="row"]').first().text());
          if (!code) return;
          const description = textTrim($(tr).find("td").first().text());
          const squareFeet = parseSquareFeet(
            textTrim($(tr).find("td").eq(1).text()),
          );
          const mapped = mapSubAreaCode(code, description);
          if (mapped && mapped.matched === false) {
            fallbackCodes.add(code);
          }
          entries.push({
            code,
            description:
              mapped && mapped.description
                ? mapped.description
                : description || null,
            size_square_feet:
              squareFeet != null && Number.isFinite(squareFeet)
                ? squareFeet
                : null,
            space_type: mapped ? mapped.space_type : null,
            is_exterior:
              mapped && Object.prototype.hasOwnProperty.call(mapped, "is_exterior")
                ? mapped.is_exterior
                : null,
            is_finished:
              mapped && Object.prototype.hasOwnProperty.call(mapped, "is_finished")
                ? mapped.is_finished
                : null,
          });
        });
      perBuilding[index] = entries;
    },
  );
  return { perBuilding, fallbackCodes };
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function parseBathrooms(value) {
  if (!value) return { full: 0, half: 0 };
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return { full: 0, half: 0 };
  const full = Math.floor(num);
  const remainder = num - full;
  const half = remainder >= 0.5 ? 1 : 0;
  return { full, half };
}

function mapBuildingSpaceType(typeLabel) {
  const result = { space_type: "Building", is_exterior: false };
  if (!typeLabel) return result;
  const s = typeLabel.toUpperCase();
  const contains = (fragment) => s.includes(fragment);

  if (contains("GARAGE")) {
    result.space_type = contains("DET") ? "Detached Garage" : "Attached Garage";
    return result;
  }
  if (contains("CARPORT")) {
    result.space_type = contains("DET")
      ? "Detached Carport"
      : "Attached Carport";
    result.is_exterior = true;
    return result;
  }
  if (contains("SCREEN") && contains("ENCLOSURE")) {
    if (contains("3")) result.space_type = "Screen Enclosure (3-Story)";
    else if (contains("2")) result.space_type = "Screen Enclosure (2-Story)";
    else if (contains("1")) result.space_type = "Screen Porch (1-Story)";
    else result.space_type = "Screen Enclosure (Custom)";
    result.is_exterior = true;
    return result;
  }
  if (contains("SCREEN") && contains("PORCH")) {
    result.space_type = "Screened Porch";
    result.is_exterior = true;
    return result;
  }
  if (contains("PORCH")) {
    result.space_type = contains("OPEN") ? "Open Porch" : "Porch";
    result.is_exterior = true;
    return result;
  }
  if (contains("LANAI")) {
    result.space_type = "Lanai";
    result.is_exterior = true;
    return result;
  }
  if (contains("DECK")) {
    result.space_type = "Deck";
    result.is_exterior = true;
    return result;
  }
  if (contains("GAZEBO")) {
    result.space_type = "Gazebo";
    result.is_exterior = true;
    return result;
  }
  if (contains("PERGOLA")) {
    result.space_type = "Pergola";
    result.is_exterior = true;
    return result;
  }
  if (contains("PATIO")) {
    result.space_type = "Patio";
    result.is_exterior = true;
    return result;
  }
  if (contains("COURTYARD")) {
    result.space_type = contains("OPEN") ? "Open Courtyard" : "Courtyard";
    result.is_exterior = true;
    return result;
  }
  if (contains("CABANA")) {
    result.space_type = "Enclosed Cabana";
    result.is_exterior = true;
    return result;
  }
  if (contains("UTILITY") || contains("SHED")) {
    result.space_type = "Shed";
    result.is_exterior = true;
    return result;
  }
  if (contains("POOL HOUSE")) {
    result.space_type = "Pool House";
    result.is_exterior = true;
    return result;
  }
  if (contains("OUTDOOR POOL")) {
    result.space_type = "Outdoor Pool";
    result.is_exterior = true;
    return result;
  }
  if (contains("INDOOR POOL")) {
    result.space_type = "Indoor Pool";
    return result;
  }
  if (contains("POOL") && contains("AREA")) {
    result.space_type = "Pool Area";
    result.is_exterior = true;
    return result;
  }
  if (contains("BARN")) {
    result.space_type = "Barn";
    return result;
  }
  if (contains("WORKSHOP")) {
    result.space_type = "Workshop";
    return result;
  }
  if (contains("STORAGE")) {
    result.space_type = "Storage Room";
    return result;
  }
  if (contains("MECHANICAL")) {
    result.space_type = "Mechanical Room";
    return result;
  }
  if (contains("RECREATION")) {
    result.space_type = "Common Room";
    return result;
  }
  return result;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);

  
  
  if (!parcelId) throw new Error("Parcel ID not found");
  const { perBuilding: subAreasByIndex, fallbackCodes } =
    collectSubAreaDetails($);

  const buildings = collectBuildings($).map((raw, idx) => {
    const heated = toInt(raw["Heated Area"]) || null;
    const bedrooms = toInt(raw["Bedrooms"]);
    const baths = parseBathrooms(raw["Bathrooms"]);
    const mapped = mapBuildingSpaceType(raw["Type"] || "");

    const roomsBase = [];
    if (bedrooms > 0) {
      roomsBase.push({ space_type: "Bedroom", count: bedrooms });
    }
    if (baths.full > 0) {
      roomsBase.push({ space_type: "Full Bathroom", count: baths.full });
    }
    if (baths.half > 0) {
      roomsBase.push({
        space_type: "Half Bathroom / Powder Room",
        count: baths.half,
      });
    }
    const rawSubAreas = Array.isArray(subAreasByIndex[idx])
      ? subAreasByIndex[idx]
      : [];
    const subAreaDetails = rawSubAreas.map((entry) => ({
      code: entry.code,
      description: entry.description,
      size_square_feet: entry.size_square_feet,
      space_type: entry.space_type,
      is_exterior:
        entry.is_exterior == null ? null : Boolean(entry.is_exterior),
      is_finished:
        entry.is_finished == null ? null : Boolean(entry.is_finished),
    }));
    const subAreaRooms = subAreaDetails.map((entry) => ({
      space_type: entry.space_type,
      size_square_feet: entry.size_square_feet,
      is_exterior: entry.is_exterior == null ? false : entry.is_exterior,
      is_finished: entry.is_finished,
      sub_area_code: entry.code,
      description: entry.description,
    }));
    const rooms = [...roomsBase, ...subAreaRooms];
    return {
      building_index: idx + 1,
      type_label: raw["Type"] || null,
      space_type: mapped.space_type,
      is_exterior: mapped.is_exterior,
      heated_area_sq_ft: heated,
      total_area_sq_ft: heated,
      livable_area_sq_ft: heated,
      stories: raw["Stories"] ? Number(raw["Stories"]) || null : null,
      rooms,
      floors: [],
      sub_areas: subAreaDetails,
    };
  });

  const combinedUnmapped = new Set([
    ...fallbackCodes,
    ...getDefaultedSubAreaCodes(),
  ]);
  if (combinedUnmapped.size) {
    console.warn(
      `Sub area codes using default mapping: ${Array.from(combinedUnmapped).sort().join(", ")}`,
    );
  }

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { buildings };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
