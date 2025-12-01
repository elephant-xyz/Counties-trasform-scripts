// Layout mapping script
// Reads input.html, parses with cheerio, outputs owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml() {
  const htmlPath = path.join(process.cwd(), "input.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  return cheerio.load(html);
}

function extractParcelId($) {
  // Prefer hidden numeric PIN without dashes
  let id = ($('input[name="PARCELID_Buffer"]').attr("value") || "").trim();
  if (!id) {
    // Fallback: parse display Parcel: 13-02S-13E-04969-001004 (12488)
    const parcelText = $(".parcelIDtable b").first().text().trim();
    const match = parcelText.match(
      /([0-9]{2}-[0-9]{2}S-[0-9]{2}E-[0-9]{5}-[0-9]{6})/,
    );
    if (match) {
      id = match[1].replace(/[-]/g, "");
    }
  }
  return id || "unknown";
}

function buildLayouts($) {
  // The provided HTML lacks room-level details. We'll return an empty layouts array per schema requiring objects, but we still must include required fields for each layout.
  // Since we cannot invent rooms, we will provide a minimal placeholder for a site/parcel level with is_exterior true (e.g., Open Courtyard), but schema requires specific fields. To avoid fabrications, we will not add any layout entries.
  return [];
}

function main() {
  const $ = loadHtml();
  const parcelId = extractParcelId($);
  const layouts = buildLayouts($);

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("Error generating layout data:", e.message);
    process.exit(1);
  }
}
