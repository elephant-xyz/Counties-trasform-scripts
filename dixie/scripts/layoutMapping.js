// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl00_ctl01_lblParcelID";
const BUILDING_SECTION_TITLE = "Buildings";

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
        BUILDING_SECTION_TITLE || textTrim($(s).find(".title").first().text()) ===
        BUILDING_SECTION_TITLE,
    )
    .first();

  if (!section.length) return buildings;
  
  $(section).find(".block-row").each((_, blockRow) => {
    const building = {};
    
    $(blockRow).find(".two-column-blocks").each((__, columnBlock) => {
      $(columnBlock).find("table tbody tr").each((___, tr) => {
        const label = textTrim($(tr).find("th strong").first().text()) || textTrim($(tr).find("td strong").first().text());
        const value = textTrim($(tr).find("td span").first().text());
        if (label) building[label] = value;
      });
    });
    
    if (Object.keys(building).length) buildings.push(building);
  });
  
  return buildings;
}

function toInt(val) {
  const n = Number(
    String(val || "")
      .replace(/[,]/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function mapSpaceType(spaceType) {
  if (!spaceType) return null;
  const validTypes = new Set([
    "Living Room", "Family Room", "Great Room", "Dining Room", "Kitchen", "Breakfast Nook", "Pantry",
    "Primary Bedroom", "Secondary Bedroom", "Guest Bedroom", "Children's Bedroom", "Nursery", "Bedroom",
    "Full Bathroom", "Three-Quarter Bathroom", "Half Bathroom / Powder Room", "En-Suite Bathroom",
    "Jack-and-Jill Bathroom", "Primary Bathroom", "Laundry Room", "Mudroom", "Closet", "Walk-in Closet",
    "Mechanical Room", "Storage Room", "Server/IT Closet", "Home Office", "Library", "Den", "Study",
    "Media Room / Home Theater", "Game Room", "Home Gym", "Music Room", "Craft Room / Hobby Room",
    "Prayer Room / Meditation Room", "Safe Room / Panic Room", "Wine Cellar", "Bar Area", "Greenhouse",
    "Attached Garage", "Detached Garage", "Carport", "Workshop", "Storage Loft", "Porch", "Screened Porch",
    "Sunroom", "Deck", "Patio", "Pergola", "Balcony", "Terrace", "Gazebo", "Pool House", "Outdoor Kitchen",
    "Lobby / Entry Hall", "Common Room", "Utility Closet", "Elevator Lobby", "Mail Room", "Janitor's Closet",
    "Pool Area", "Indoor Pool", "Outdoor Pool", "Hot Tub / Spa Area", "Shed", "Lanai", "Open Porch",
    "Enclosed Porch", "Attic", "Enclosed Cabana", "Attached Carport", "Detached Carport",
    "Detached Utility Closet", "Jacuzzi", "Courtyard", "Open Courtyard", "Screen Porch (1-Story)",
    "Screen Enclosure (2-Story)", "Screen Enclosure (3-Story)", "Screen Enclosure (Custom)",
    "Lower Garage", "Lower Screened Porch", "Stoop", "First Floor", "Second Floor", "Third Floor",
    "Fourth Floor", "Basement", "Sub-Basement", "Living Area"
  ]);
  return validTypes.has(spaceType) ? spaceType : null;
}

function defaultLayout(space_type, idx, parcelId) {
  return {
    source_http_request: {
      method: "GET",
      url: "https://qpublic.schneidercorp.com/application.aspx",
      multiValueQueryString: {
        AppID: ["1207"],
        LayerID: ["36374"],
        PageTypeID: ["4"],
        PageID: ["13872"],
        Q: ["47389550"],
        KeyValue: [parcelId]
      }
    },
    request_identifier: parcelId,
    space_type: mapSpaceType(space_type),
    space_index: idx,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: null,
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
    pool_water_quality: null
  };
}

function buildLayoutsFromBuildings(buildings, parcelId) {
  // Sum across all buildings
  let totalBeds = 0;
  let totalFullBaths = 0;
  let totalThreeQtrBaths = 0;
  let totalHalfBaths = 0;

  let heatedArea = null;
  
  buildings.forEach((b) => {
    totalBeds += toInt(b["Bedrooms"]);
    totalFullBaths += toInt(b["Full Bath"]);
    totalFullBaths += toInt(b["Addl Bath"]);

    totalThreeQtrBaths += toInt(b["Three Qtr Bath"]);
    totalThreeQtrBaths += toInt(b["Addl Three Qtr Bath"]);

    totalHalfBaths += toInt(b["Half Bath"]);
    totalHalfBaths += toInt(b["Addl Half Bath"]);

    if (b["Heated Area"]) {
      heatedArea = toInt(b["Heated Area"]);
    }
  });

  const layouts = [];
  let idx = 1;
  
  // Add bedrooms
  for (let i = 0; i < totalBeds; i++) {
    const layout = defaultLayout("Bedroom", idx++, parcelId);
    layout.heated_area_sq_ft = heatedArea;
    layouts.push(layout);
  }
  
  // Add full bath
  for (let i = 0; i < totalFullBaths; i++) {
    const layout = defaultLayout("Full Bathroom", idx++, parcelId);
    layout.heated_area_sq_ft = heatedArea;
    layouts.push(layout);
  }

  // Add half bathrooms
  for (let i = 0; i < totalHalfBaths; i++) {
    const layout = defaultLayout("Half Bathroom", idx++, parcelId);
    layout.heated_area_sq_ft = heatedArea;
    layouts.push(layout);
  }
    // Add bathrooms
  for (let i = 0; i < totalThreeQtrBaths; i++) {
    const layout = defaultLayout("Three-Quarter Bathroom", idx++, parcelId);
    layout.heated_area_sq_ft = heatedArea;
    layouts.push(layout);
  }
    
  return layouts;
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  console.log(buildings);
  const layouts = buildLayoutsFromBuildings(buildings, parcelId);
  
  console.log(`Found ${buildings.length} buildings`);
  console.log(`Generated ${layouts.length} layout entries`);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${layouts.length} layouts to ${outPath}`);
}

if (require.main === module) {
  main();
}