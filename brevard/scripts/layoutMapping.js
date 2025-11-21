// Layout mapping script (revised)
// Reads input.html, extracts layout data using cheerio, writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function textClean(t) {
  return (t || "").replace(/\s+/g, " ").trim();
}
function intFromText(t) {
  if (!t) return null;
  const n = String(t).replace(/[^0-9]/g, "");
  return n ? parseInt(n, 10) : null;
}

function mapSubAreaToSpaceType(label) {
  const upper = label.toUpperCase();
  if (/BASE\s+AREA/i.test(upper)) return null;
  if (/LIVING\s+AREA/i.test(upper)) {
    return { space_type: "Living Area", is_exterior: false };
  }
  if (/BALCONY/.test(upper)) {
    return { space_type: "Balcony", is_exterior: true };
  }
  if (/ENCLOSED\s*POR/.test(upper)) {
    return { space_type: "Enclosed Porch", is_exterior: true };
  }
  if (/OPEN\s*POR/.test(upper)) {
    return { space_type: "Open Porch", is_exterior: true };
  }
  if (/SCREEN\s*POR/.test(upper)) {
    return { space_type: "Screened Porch", is_exterior: true };
  }
  if (/SCREEN\s*ENC/i.test(upper)) {
    return { space_type: "Screen Enclosure (Custom)", is_exterior: true };
  }
  if (/PORCH/.test(upper)) {
    return { space_type: "Porch", is_exterior: true };
  }
  if (/BREEZEWAY/.test(upper)) {
    return { space_type: "Open Porch", is_exterior: true };
  }
  if (/VERANDA/.test(upper)) {
    return { space_type: "Open Porch", is_exterior: true };
  }
  if (/GARAGE/.test(upper)) {
    if (/LOWER/.test(upper)) {
      return { space_type: "Lower Garage", is_exterior: false };
    }
    if (/DET/.test(upper) || /DTD/.test(upper)) {
      return { space_type: "Detached Garage", is_exterior: false };
    }
    return { space_type: "Attached Garage", is_exterior: false };
  }
  if (/CARPORT/.test(upper)) {
    if (/DET/.test(upper) || /DTD/.test(upper)) {
      return { space_type: "Detached Carport", is_exterior: true };
    }
    if (/ATT/.test(upper)) {
      return { space_type: "Attached Carport", is_exterior: true };
    }
    return { space_type: "Carport", is_exterior: true };
  }
  if (/LANAI/.test(upper)) {
    return { space_type: "Lanai", is_exterior: true };
  }
  if (/CABANA/.test(upper)) {
    return { space_type: "Enclosed Cabana", is_exterior: true };
  }
  if (/POOL\s*DECK/.test(upper)) {
    return { space_type: "Pool Area", is_exterior: true };
  }
  if (/DECK/.test(upper)) {
    return { space_type: "Deck", is_exterior: true };
  }
  if (/POOL\s*ENC/.test(upper) || /POOL\s*SCR/.test(upper)) {
    return { space_type: "Pool Area", is_exterior: true };
  }
  if (/POOL\s*HOUSE/.test(upper)) {
    return { space_type: "Pool House", is_exterior: true };
  }
  if (/PATIO/.test(upper)) {
    return { space_type: "Patio", is_exterior: true };
  }
  if (/GAZEBO/.test(upper)) {
    return { space_type: "Gazebo", is_exterior: true };
  }
  if (/PERGOLA/.test(upper)) {
    return { space_type: "Pergola", is_exterior: true };
  }
  if (/CANOPY/.test(upper)) {
    return { space_type: "Pergola", is_exterior: true };
  }
  if (/STOOP/.test(upper)) {
    return { space_type: "Stoop", is_exterior: true };
  }
  if (/UTILITY/.test(upper)) {
    if (/DET/.test(upper) || /DTD/.test(upper)) {
      return { space_type: "Detached Utility Closet", is_exterior: true };
    }
    return { space_type: "Utility Closet", is_exterior: false };
  }
  if (/SHED/.test(upper)) {
    return { space_type: "Shed", is_exterior: true };
  }
  if (/GREEN\s*HOUSE/.test(upper)) {
    return { space_type: "Greenhouse", is_exterior: true };
  }
  if (/STORAGE/.test(upper)) {
    return { space_type: "Storage Room", is_exterior: false };
  }
  if (/WORKSHOP/.test(upper) || /WORK RM/.test(upper)) {
    return { space_type: "Workshop", is_exterior: false };
  }
  if (/MECH/.test(upper) || /MECHANICAL/.test(upper)) {
    return { space_type: "Mechanical Room", is_exterior: false };
  }
  if (/ATTIC/.test(upper)) {
    return { space_type: "Attic", is_exterior: false };
  }
  if (/ENCLOSED\s+CABANA/.test(upper)) {
    return { space_type: "Enclosed Cabana", is_exterior: true };
  }
  if (/COURTYARD/.test(upper)) {
    if (/OPEN/.test(upper)) {
      return { space_type: "Open Courtyard", is_exterior: true };
    }
    return { space_type: "Courtyard", is_exterior: true };
  }
  if (/SUNROOM/.test(upper)) {
    return { space_type: "Sunroom", is_exterior: false };
  }
  if (/LOFT/.test(upper)) {
    return { space_type: "Storage Loft", is_exterior: false };
  }
  if (/HOT\s*TUB/.test(upper) || /SPA/.test(upper)) {
    return { space_type: "Hot Tub / Spa Area", is_exterior: true };
  }
  if (/POOL/.test(upper)) {
    return { space_type: "Pool Area", is_exterior: true };
  }
  if (/STAIR/.test(upper) || /STEP/.test(upper)) {
    return { space_type: "Stoop", is_exterior: true };
  }
  return null;
}

function buildBuildingAndFloorLayouts($) {
  const layouts = [];
  const buildingPanels = $(
    "#divSearchDetails_Building .cssSearchDetails_Panels_Inner",
  ).filter((_, el) => textClean($(el).text()).length > 0);

  if (buildingPanels.length === 0) return layouts;

  const addLayout = (layout) => {
    layouts.push(layout);
  };

  buildingPanels.each((panelIdx, panelEl) => {
    const panel = $(panelEl);
    const buildingNumber = panelIdx + 1;
    const buildingIndexStr = String(buildingNumber);

    let yearBuilt = null;
    let floors = null;

    panel
      .find("div#divBldg_Details table.cssWidth100 tbody tr")
      .each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length < 2) return;
        const label = textClean($(cells[0]).text());
        const value = textClean($(cells[1]).text());
        if (!label) return;
        if (/Year Built/i.test(label)) yearBuilt = intFromText(value);
        if (/Floors/i.test(label)) floors = intFromText(value);
      });

    let totalBaseArea = null;
    let totalSubArea = null;
    const floorAreas = new Map();
    const subAreaSpaces = [];

    panel
      .find("div#divBldg_SubAreas table.report-table.left-table tbody tr")
      .each((_, tr) => {
        const cells = $(tr).find("td");
        if (cells.length < 2) return;
        const label = textClean($(cells[0]).text());
        const value = textClean($(cells[1]).text());
        if (!label) return;

        if (/^Total Base Area$/i.test(label)) {
          totalBaseArea = intFromText(value);
          return;
        }
        if (/^Total Sub Area$/i.test(label)) {
          totalSubArea = intFromText(value);
          return;
        }

        const mapping = mapSubAreaToSpaceType(label);

        const baseMatch = label.match(/Base Area\s+(\d+)/i);
        if (baseMatch) {
          const flNum = parseInt(baseMatch[1], 10);
          const areaVal = intFromText(value);
          if (Number.isFinite(flNum) && areaVal != null) {
            floorAreas.set(flNum, (floorAreas.get(flNum) || 0) + areaVal);
          }
          return;
        }

        if (mapping) {
          subAreaSpaces.push({
            space_type: mapping.space_type,
            is_exterior: mapping.is_exterior,
            size: intFromText(value),
          });
        }
      });

    addLayout({
      space_type: "Building",
      space_type_index: buildingIndexStr,
      building_number: buildingNumber,
      built_year: yearBuilt,
      livable_area_sq_ft: totalBaseArea,
      total_area_sq_ft: totalSubArea,
      is_finished: true,
      is_exterior: false,
    });

    const typeCounters = new Map();
    const nextTypeIndex = (type) => {
      const current = typeCounters.get(type) || 0;
      const next = current + 1;
      typeCounters.set(type, next);
      return `${buildingIndexStr}.${next}`;
    };

    const floorCount =
      Number.isFinite(floors) && floors > 0
        ? floors
        : Math.max(0, ...floorAreas.keys());

    for (let floorNum = 1; floorNum <= floorCount; floorNum += 1) {
      const floorArea = floorAreas.get(floorNum) || null;
      addLayout({
        space_type: "Floor",
        space_type_index: nextTypeIndex("Floor"),
        building_number: buildingNumber,
        // floor_level: floorNum,
        livable_area_sq_ft: floorArea,
        total_area_sq_ft: floorArea,
        size_square_feet: floorArea,
        is_finished: true,
        is_exterior: false,
      });
    }

    if (subAreaSpaces.length > 0) {
      subAreaSpaces.forEach((space) => {
        addLayout({
          space_type: space.space_type,
          space_type_index: nextTypeIndex(space.space_type),
          building_number: buildingNumber,
          size_square_feet: space.size || null,
          total_area_sq_ft: space.size || null,
          is_finished: !space.is_exterior,
          is_exterior: space.is_exterior,
        });
      });
    }
  });

  return layouts;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function extract() {
  const html = fs.readFileSync("input.html", "utf8");
  const $ = cheerio.load(html);

  const account = textClean($("#hfAccount").attr("value")) || null;
  const propKey = account ? `property_${account}` : "property_unknown";

  const layouts = buildBuildingAndFloorLayouts($);

  const out = {};
  out[propKey] = { layouts };

  ensureDir("owners");
  fs.writeFileSync(
    path.join("owners", "layout_data.json"),
    JSON.stringify(out, null, 2),
    "utf8",
  );
}

extract();
