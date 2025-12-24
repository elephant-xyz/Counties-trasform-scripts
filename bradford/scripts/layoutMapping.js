// layoutMapping.js
// Reads input.html, parses with cheerio, extracts layout data, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

function extractBaseAndActualSF($) {
  let base = null,
    actual = null;
  // Updated selector based on the provided HTML
  const rows = $(
    "#parcelDetails_BldgTable table.parcelDetails_insideTable tr[bgcolor]",
  );
  rows.each((i, el) => {
    const tds = $(el).find("td");
    // Check for the row containing "SINGLE FAM" description
    if (tds.length >= 6) {
      const desc = $(tds[1]).text().trim();
      const b = getNumber($(tds[3]).text());
      const a = getNumber($(tds[4]).text());
      if (/SINGLE FAM/i.test(desc)) { // Changed from OFFICE to SINGLE FAM
        base = b;
        actual = a;
      }
      // If no "SINGLE FAM" found, and it's the first row, use its values as a fallback
      if (base == null && i === 0) {
        base = b;
        actual = a;
      }
    }
  });
  return { base, actual };
}

function buildDefaultLayoutEntries(baseSF, actualSF) {
  // No room-level data available in provided HTML examples.
  return [];
}

function main() {
  const html = readInputHtml();
  if (!html) return;
  const $ = cheerio.load(html);
  const parcelId = extractParcelId($);
  const { base, actual } = extractBaseAndActualSF($);
  const layouts = buildDefaultLayoutEntries(base, actual);

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
