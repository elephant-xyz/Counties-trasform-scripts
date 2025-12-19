// layoutMapping.js
// Reads input.html, parses with cheerio, extracts layout data, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const DEFAULT_LAYOUT_SPACE_TYPE = "Building";

function mapLayoutSpaceType(description) {
  if (!description) return DEFAULT_LAYOUT_SPACE_TYPE;
  const upper = description.toUpperCase().replace(/[.\-]/g, " ");
  const normalized = upper.replace(/\s+/g, " ").trim();
  const contains = (token) => normalized.includes(token);
  const equalsAny = (...values) =>
    values.some((val) => normalized === val || normalized === val.replace(/\s+/g, " "));

  if (equalsAny("LR", "LIV", "LIV RM", "LIVING RM", "LIVING ROOM", "LIVINGROOM"))
    return "Living Room";
  if (equalsAny("FR", "FAM RM", "FAMILY RM", "FAMILY ROOM", "FAMILYROOM"))
    return "Family Room";
  if (equalsAny("GR", "GREAT RM", "GREAT ROOM")) return "Great Room";
  if (equalsAny("DR", "DIN RM", "DINING RM", "DINING ROOM")) return "Dining Room";
  if (equalsAny("K", "KIT", "KIT RM", "KITCHEN", "KITCHEN ROOM")) return "Kitchen";
  if (equalsAny("BR", "BDRM", "BED RM", "BEDROOM", "BED ROOM")) return "Bedroom";
  if (equalsAny("MBR", "MASTER BR", "PRIMARY BR", "PRIMARY BEDROOM")) return "Primary Bedroom";
  if (equalsAny("SBR", "SEC BR", "SECONDARY BR", "SECONDARY BEDROOM"))
    return "Secondary Bedroom";
  if (equalsAny("PR", "PDR", "POWDER RM", "HALF BATH", "HALF BATHROOM"))
    return "Half Bathroom / Powder Room";
  if (equalsAny("BA", "BATH", "BATH RM", "FULL BATH", "FULL BATHROOM"))
    return "Full Bathroom";
  if (contains("PRIMARY") && contains("BED")) return "Primary Bedroom";
  if ((contains("GUEST") || contains("SECONDARY") || contains("SEC")) && contains("BED"))
    return "Secondary Bedroom";
  if (contains("BED")) return "Bedroom";
  if (contains("EN SUITE") && contains("BATH")) return "En-Suite Bathroom";
  if (contains("BATH")) {
    if (contains("HALF")) return "Half Bathroom / Powder Room";
    return "Full Bathroom";
  }
  if (contains("KITCH")) return "Kitchen";
  if (contains("DINING")) return "Dining Room";
  if (contains("LIVING")) return "Living Room";
  if (contains("FAMILY")) return "Family Room";
  if (contains("OFFICE")) return "Office Room";
  if (contains("LIBRARY")) return "Library";
  if (contains("STUDY") || contains("DEN")) return "Den";
  if (contains("MEDIA") || contains("THEATER")) return "Media Room / Home Theater";
  if (contains("GAME")) return "Game Room";
  if (contains("GYM")) return "Home Gym";
  if (contains("MUSIC")) return "Music Room";
  if (contains("CRAFT") || contains("HOBBY")) return "Craft Room / Hobby Room";
  if (contains("PRAYER") || contains("MEDITATION")) return "Prayer Room / Meditation Room";
  if (contains("SAFE") || contains("PANIC")) return "Safe Room / Panic Room";
  if (contains("WINE")) return "Wine Cellar";
  if (contains("BAR") && contains("AREA")) return "Bar Area";
  if (contains("GREENHOUSE")) return "Greenhouse";
  if (contains("PORCH") && contains("SCREEN")) return "Screened Porch";
  if (contains("PORCH")) return "Open Porch";
  if (contains("SUNROOM") || contains("SUN ROOM")) return "Sunroom";
  if (contains("DECK")) return "Deck";
  if (contains("PATIO")) return "Patio";
  if (contains("BALCONY")) return "Balcony";
  if (contains("TERRACE")) return "Terrace";
  if (contains("GAZEBO")) return "Gazebo";
  if (contains("POOL HOUSE")) return "Pool House";
  if (contains("OUTDOOR KITCHEN")) return "Outdoor Kitchen";
  if (contains("LOBBY") && contains("ENTRY")) return "Lobby / Entry Hall";
  if (contains("COMMON ROOM")) return "Common Room";
  if (contains("UTILITY") && contains("CLOSET")) return "Utility Closet";
  if (contains("UTILITY")) return "Utility Closet";
  if (contains("ELEVATOR") && contains("LOBBY")) return "Elevator Lobby";
  if (contains("MAIL ROOM")) return "Mail Room";
  if (contains("JANITOR")) return "Janitor’s Closet";
  if (contains("POOL AREA")) return "Pool Area";
  if (contains("INDOOR POOL")) return "Indoor Pool";
  if (contains("OUTDOOR POOL")) return "Outdoor Pool";
  if (contains("HOT TUB") || contains("SPA AREA")) return "Hot Tub / Spa Area";
  if (contains("SHED")) return "Shed";
  if (contains("LANAI")) return "Lanai";
  if (contains("CABANA")) return "Enclosed Cabana";
  if (contains("GARAGE")) {
    if (contains("DETACHED")) return "Detached Garage";
    if (contains("LOWER")) return "Lower Garage";
    return "Attached Garage";
  }
  if (contains("CARPORT")) {
    if (contains("DETACHED")) return "Detached Carport";
    if (contains("ATTACHED")) return "Attached Carport";
    return "Carport";
  }
  if (contains("WORKSHOP")) return "Workshop";
  if (contains("STORAGE") && contains("LOFT")) return "Storage Loft";
  if (contains("STORAGE")) return "Storage Room";
  if (contains("CLOSET") && contains("WALK")) return "Walk-in Closet";
  if (contains("CLOSET")) return "Closet";
  if (contains("MECHANICAL")) return "Mechanical Room";
  if (contains("LAUNDRY")) return "Laundry Room";
  if (contains("MUD")) return "Mudroom";
  if (contains("COURTYARD") && contains("OPEN")) return "Open Courtyard";
  if (contains("COURTYARD")) return "Courtyard";
  if (contains("ATTIC")) return "Attic";
  if (contains("BASEMENT")) return "Basement";
  return DEFAULT_LAYOUT_SPACE_TYPE;
}

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
  const boldTxt = $(".parcelIDtable b").first().text().trim();
  if (!boldTxt) return "unknown";
  const m = boldTxt.match(/^([^\s(]+)/);
  return m ? m[1] : "unknown";
}

function parseNumberFromText(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (cleaned === "") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

function formatName(name) {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractBuildingLayouts($) {
  const layouts = [];
  const table = $("#parcelDetails_BldgTable table.parcelDetails_insideTable").first();
  if (!table.length) return layouts;
  table.find("tr").each((idx, row) => {
    if (idx === 0) return;
    const tds = $(row).find("td");
    if (tds.length >= 5) {
      const description = tds.eq(2).text().trim();
      const baseSF = parseNumberFromText(tds.eq(4).text().trim());
      const yearBuiltText = tds.eq(3).text().trim();
      const yearBuilt = /^\d{4}$/.test(yearBuiltText) ? Number(yearBuiltText) : null;
      if (description || baseSF != null) {
        layouts.push({
          description,
          size_square_feet: baseSF,
          built_year: yearBuilt,
        });
      }
    }
  });
  return layouts;
}

function buildLayoutRecords(layouts) {
  return layouts
    .filter(
      (entry) =>
        (entry.description && entry.description.trim() !== "") ||
        entry.size_square_feet != null,
    )
    .map((entry, idx) => {
      const size = entry.size_square_feet ?? null;
      const mappedSpaceType = mapLayoutSpaceType(entry.description);
      return {
        description: entry.description || null,
        source_http_request: null,
        request_identifier: null,
        space_type: mappedSpaceType,
        space_type_index: String(idx + 1),
        flooring_material_type: null,
        size_square_feet: size,
        has_windows: null,
        window_design_type: null,
        window_material_type: null,
        window_treatment_type: null,
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
        adjustable_area_sq_ft: null,
        area_under_air_sq_ft: size,
        heated_area_sq_ft: size,
        livable_area_sq_ft: size,
        total_area_sq_ft: null,
        built_year: entry.built_year ?? null,
      };
    })
    .filter((record) => record.space_type !== null);
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const buildingLayouts = extractBuildingLayouts($);
  const layouts = buildLayoutRecords(buildingLayouts);

  const outputDir = path.resolve("owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, "layout_data.json");

  const out = {};
  out[`property_${parcelId}`] = { layouts };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote", outPath);
}

if (require.main === module) {
  main();
}
