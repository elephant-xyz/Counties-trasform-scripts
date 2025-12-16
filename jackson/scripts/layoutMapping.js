// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

const PARCEL_SELECTOR = "#ctlBodyPane_ctl02_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue";
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
    "Fourth Floor", "Basement", "Sub-Basement", "Living Area", "Building"
  ]);
  return validTypes.has(spaceType) ? spaceType : null;
}

function defaultLayout({ space_type, space_type_index, parcelId, building_number }) {
  const layout = {
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
    space_type_index: space_type_index || null,
    building_number: Number.isFinite(building_number) ? building_number : null,
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
    pool_water_quality: null,
    heated_area_sq_ft: null,
    total_area_sq_ft: null,
    livable_area_sq_ft: null
  };

  return layout;
}

function buildLayoutsFromBuildings(buildings, parcelId) {
  const layouts = [];

  buildings.forEach((building, idx) => {
    const buildingNumber = idx + 1;
    layouts.push(...buildLayoutsForSingleBuilding(building, buildingNumber, parcelId));
  });

  return layouts;
}

function buildLayoutsForSingleBuilding(building, buildingNumber, parcelId) {
  const layouts = [];
  const heatedArea = toInt(building["Heated Area"]);
  const totalArea = toInt(building["Total Area"]);
  const livingArea = toInt(building["Living Area"]);

  const buildingLayout = defaultLayout({
    space_type: "Building",
    space_type_index: String(buildingNumber),
    parcelId,
    building_number: buildingNumber
  });

  if (heatedArea > 0) buildingLayout.heated_area_sq_ft = heatedArea;
  if (totalArea > 0) buildingLayout.total_area_sq_ft = totalArea;
  if (livingArea > 0) buildingLayout.livable_area_sq_ft = livingArea;
  layouts.push(buildingLayout);

  const typeCounters = Object.create(null);
  function nextSpaceTypeIndex(spaceType) {
    const current = (typeCounters[spaceType] || 0) + 1;
    typeCounters[spaceType] = current;
    return `${buildingNumber}.${current}`;
  }

  function addSpaces(count, spaceType) {
    for (let i = 0; i < count; i++) {
      const layout = defaultLayout({
        space_type: spaceType,
        space_type_index: nextSpaceTypeIndex(spaceType),
        parcelId,
        building_number: buildingNumber
      });
      if (heatedArea > 0) layout.heated_area_sq_ft = heatedArea;
      layouts.push(layout);
    }
  }

  const bedroomCount = toInt(building["Bedrooms"]);
  const bathroomCounts = getBathroomCounts(building);

  addSpaces(bathroomCounts.full, "Full Bathroom");
  addSpaces(bathroomCounts.half, "Half Bathroom / Powder Room");
  addSpaces(bathroomCounts.threeQuarter, "Three-Quarter Bathroom");
  addSpaces(bedroomCount, "Bedroom");

  return layouts;
}

function getBathroomCounts(building) {
  const summarized = parseFloat(building["Bathrooms"] || 0);
  if (summarized > 0) {
    const full = Math.floor(summarized);
    const half = (summarized % 1) === 0.5 ? 1 : 0;
    return { full, half, threeQuarter: 0 };
  }

  return {
    full: toInt(building["Full Bath"]) + toInt(building["Addl Bath"]),
    half: toInt(building["Half Bath"]) + toInt(building["Addl Half Bath"]),
    threeQuarter:
      toInt(building["Three Qtr Bath"]) + toInt(building["Addl Three Qtr Bath"])
  };
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
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
