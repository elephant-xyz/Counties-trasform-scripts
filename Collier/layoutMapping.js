// Layout mapping script
// Reads input.html, extracts room layout details, and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

(function main() {
  const inputPath = "input.html";
  const html = fs.readFileSync(inputPath, "utf8");
  const $ = cheerio.load(html);

  const parcelId = $("span#ParcelID").first().text().trim() || "unknown";

  // The HTML lacks specific room details. We'll create zero layouts to avoid fabricating data.
  const layouts = [];

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join("owners", "layout_data.json");
  ensureDir(outPath);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
})();
