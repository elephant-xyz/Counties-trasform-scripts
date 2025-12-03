// layoutMapping.js
// Reads input.html, parses with cheerio, extracts layout data, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

function readInputHtml() {
  const inputPath = path.resolve("input.html");
  try {
    return fs.readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error(
      "input.html not found. Ensure the input file is available at project root.",
    );
    return null;
  }
}

function extractParcelId($) {
  // Updated selector based on the provided HTML
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function getNumber(text) {
  const m = String(text || "")
    .replace(/[,\s]/g, "")
    .match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function extractBuildingRows($) {
  const rows = [];
  $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr[bgcolor]",
  ).each((index, el) => {
    const tds = $(el).find("td");
    if (tds.length >= 6) {
      const description = $(tds[1]).text().trim();
      if (!description) return;
      const base = getNumber($(tds[3]).text());
      const actual = getNumber($(tds[4]).text());
      rows.push({
        description,
        base,
        actual,
      });
    }
  });
  return rows;
}

function parseCurrency(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseUnits(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d.]/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseDimensions(text) {
  if (!text) {
    return { text: null, width: null, length: null, area: null };
  }
  const cleaned = norm(String(text).replace(/\u00a0/g, " "));
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return { text: cleaned || null, width: null, length: null, area: null };
  }
  const width = Number(match[1]);
  const length = Number(match[2]);
  const area =
    Number.isFinite(width) && Number.isFinite(length) && width > 0 && length > 0
      ? width * length
      : null;
  return {
    text: cleaned || null,
    width: Number.isFinite(width) ? width : null,
    length: Number.isFinite(length) ? length : null,
    area,
  };
}

const FEATURE_PATTERNS = {
  utility: [
    /UTILITY/i,
    /WELL/i,
    /SEPTIC/i,
    /IRRIGATION/i,
    /SPRINK/i,
    /PUMP/i,
    /POWER/i,
    /ELECTRIC/i,
    /TRANSFORMER/i,
    /GENERATOR/i,
    /WATER/i,
    /GAS/i,
  ],
  layout: [
    /PAV(E)?MENT/i,
    /PAVERS?/i,
    /PATIO/i,
    /DRIVE/i,
    /DRIVEWAY/i,
    /SIDEWALK/i,
    /SIDE WALK/i,
    /SLAB/i,
    /COURT/i,
    /TRACK/i,
    /CONCRETE/i,
    /ASPHALT/i,
    /PARKING/i,
    /APR(o)?N/i,
  ],
  structure: [
    /BUILDING/i,
    /BARN/i,
    /GARAGE/i,
    /CARPORT/i,
    /CANOPY/i,
    /SHED/i,
    /STORAGE/i,
    /PAVILION/i,
    /CABIN/i,
    /GREENHOUSE/i,
    /DOCK/i,
    /POOL/i,
    /FENCE/i,
    /HOUSE/i,
  ],
};

function classifyFeature(description) {
  const desc = description || "";
  if (!desc) return "structure";
  const isMatch = (patterns) => patterns.some((re) => re.test(desc));
  if (isMatch(FEATURE_PATTERNS.utility)) return "utility";
  if (isMatch(FEATURE_PATTERNS.layout)) return "layout";
  if (isMatch(FEATURE_PATTERNS.structure)) return "structure";
  return "structure";
}

function mapFeatureToSpaceType(description) {
  const desc = (description || "").toUpperCase();
  if (/COURTYARD/.test(desc)) return "Courtyard";
  if (/COURT\b/.test(desc)) return "Courtyard";
  if (/PATIO/.test(desc)) return "Patio";
  if (/PORCH/.test(desc)) return "Porch";
  if (/SCREENED PORCH/.test(desc)) return "Screened Porch";
  if (/DECK/.test(desc)) return "Deck";
  if (/POOL/.test(desc)) return "Pool Area";
  if (/GAZEBO/.test(desc)) return "Gazebo";
  if (/PERGOLA/.test(desc)) return "Pergola";
  if (/BALCONY/.test(desc)) return "Balcony";
  if (/TERRACE/.test(desc)) return "Terrace";
  if (/LANAI/.test(desc)) return "Lanai";
  if (/SHED/.test(desc)) return "Shed";
  if (/CARPORT/.test(desc)) return "Carport";
  if (/GARAGE/.test(desc)) return "Detached Garage";
  return null;
}

function extractExtraFeatures($) {
  const features = [];
  const table = $("#parcelDetails_XFOBTable table.parcelDetails_insideTable").first();
  if (!table.length) return features;

  table.find("tr").each((idx, row) => {
    const tds = $(row).find("td");
    if (tds.length < 6) return;
    const codeCell = norm($(tds[0]).text());
    if (/^code$/i.test(codeCell)) return;

    const description = norm($(tds[1]).text());
    const yearBuiltRaw = norm($(tds[2]).text()).replace(/\D+/g, "");
    const value = parseCurrency($(tds[3]).text());
    const units = parseUnits($(tds[4]).text());
    const dims = parseDimensions($(tds[5]).text());

    if (!description) return;

    features.push({
      code: codeCell || null,
      description,
      year_built: yearBuiltRaw ? Number(yearBuiltRaw) : null,
      value_dollars: value,
      units: units,
      dimensions: dims.text,
      dimension_width: dims.width,
      dimension_length: dims.length,
      area_square_feet: dims.area,
      category: classifyFeature(description),
    });
  });

  return features;
}

function buildLayoutHierarchy(buildingRows) {
  if (!buildingRows.length) return { buildings: [] };

  const buildings = buildingRows.map((row, idx) => {
    const area = row.actual || row.base || null;
    const buildingNumber = idx + 1;
    return {
      building_number: buildingNumber,
      description: row.description || null,
      total_area_sq_ft: area,
      livable_area_sq_ft: area,
      area_under_air_sq_ft: area,
      floors: [],
      rooms: [],
    };
  });

  return { buildings };
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const buildingRows = extractBuildingRows($);
  const hierarchy = buildLayoutHierarchy(buildingRows);
  const extraFeatures = extractExtraFeatures($).filter(
    (feature) => feature.category === "layout",
  );

  const siteFeatures = extraFeatures
    .map((feature, idx) => {
      const spaceType = mapFeatureToSpaceType(feature.description);
      if (!spaceType) return null;
      return {
        space_type: spaceType,
        space_type_index: String(idx + 1),
        size_square_feet: feature.area_square_feet ?? null,
        total_area_sq_ft: feature.area_square_feet ?? null,
        livable_area_sq_ft: null,
        area_under_air_sq_ft: null,
        is_exterior: true,
        condition_issues: null,
      };
    })
    .filter(Boolean);

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "layout_data.json");

  const out = {};
  out[`property_${parcelId}`] = {
    ...hierarchy,
    site_features: siteFeatures,
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}
