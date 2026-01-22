// Layout mapping script
// Reads input.html, parses buildings bedroom/bath counts and generates layout entries per room type

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readHtml(filepath) {
  const html = fs.readFileSync(filepath, "utf8");
  return cheerio.load(html);
}

// Updated selectors based on the provided HTML
const PARCEL_SELECTOR =
  "#ctlBodyPane_ctl01_ctl01_dynamicSummary_rptrDynamicColumns_ctl00_pnlSingleValue span"; // Corrected to target the span containing the Parcel ID
const BUILDING_SECTION_TITLE = "Building Information"; // Corrected title from HTML

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

  // Find all building blocks within the section
  const buildingBlocks = section.find(".block-row");

  buildingBlocks.each((blockIndex, blockElement) => {
    const currentBuildingData = {};

    // Collect data from the left column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataLeftColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    // Collect data from the right column within the current building block
    $(blockElement)
      .find(
        `div[id^="ctlBodyPane_ctl04_ctl01_lstBuildings_ctl"][id$="_dynamicBuildingDataRightColumn_divSummary"]`,
      )
      .each((_, div) => {
        $(div)
          .find("table tbody tr")
          .each((__, tr) => {
            const label = textTrim($(tr).find("th strong").first().text());
            const value = textTrim($(tr).find("td div span").first().text());
            if (label) currentBuildingData[label] = value;
          });
      });

    if (Object.keys(currentBuildingData).length) {
      buildings.push(currentBuildingData);
    }
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

function toNumberOrNull(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/[,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toIntegerOrNull(val) {
  const num = toNumberOrNull(val);
  if (num == null) return null;
  const rounded = Math.round(num);
  return Number.isFinite(rounded) ? rounded : null;
}

function buildBuildingLayoutData(buildings) {
  return buildings
    .map((b, idx) => {
      const totalArea = toNumberOrNull(b["Total Area"]);
      const heatedArea =
        toNumberOrNull(b["Heated Area"]) ??
        toNumberOrNull(b["Heated Sq Ft"]) ??
        toNumberOrNull(b["Living Area"]) ??
        toNumberOrNull(b["Livable Area"]);
      const bedrooms = toInt(b["Bedrooms"]);
      const bathrooms = toInt(b["Bathrooms"]);
      const rooms = [];
      if (bedrooms > 0) {
        rooms.push({ space_type: "Bedroom", count: bedrooms });
      }
      if (bathrooms > 0) {
        rooms.push({ space_type: "Full Bathroom", count: bathrooms });
      }

      const hasMeaningfulData =
        rooms.length > 0 ||
        totalArea != null ||
        heatedArea != null ||
        (b["Type"] && textTrim(b["Type"]));

      if (!hasMeaningfulData) return null;

      return {
        building_number: idx + 1,
        building_type: b["Type"] ? textTrim(b["Type"]) || null : null,
        total_area_sq_ft: totalArea,
        livable_area_sq_ft: heatedArea,
        built_year: toIntegerOrNull(b["Actual Year Built"]),
        number_of_stories: toIntegerOrNull(b["Stories"]),
        rooms,
      };
    })
    .filter(Boolean);
}

function main() {
  const inputPath = path.resolve("input.html");
  const $ = readHtml(inputPath);
  const parcelId = getParcelId($);
  if (!parcelId) throw new Error("Parcel ID not found");
  const buildings = collectBuildings($);
  const buildingLayouts = buildBuildingLayoutData(buildings);

  const outDir = path.resolve("owners");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const outObj = {};
  outObj[`property_${parcelId}`] = { buildings: buildingLayouts };
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
}

if (require.main === module) {
  main();
}
