const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");

const html = fs.readFileSync("../input/91198.html", "utf8");
const $ = cheerio.load(html);

// Read all unique selectors from errors.csv
const errorsContent = fs.readFileSync("../errors.csv", "utf8");
const lines = errorsContent.split("\n").slice(1).filter(line => line.trim());

const selectors = new Set();
lines.forEach(line => {
  const match = line.match(/^([^,]+),/);
  if (match) {
    selectors.add(match[1]);
  }
});

console.log(`Found ${selectors.size} unique unmapped selectors\n`);

// Analyze each selector
const selectorData = [];
selectors.forEach(selector => {
  const elements = $(selector);

  if (elements.length === 0) {
    selectorData.push({
      selector,
      found: false,
      value: null,
      context: null,
      section: null,
    });
    return;
  }

  const element = elements.first();
  const value = element.text().trim();

  // Find section context
  const card = element.closest(".card");
  const cardHeader = card.find(".card-header").first().text().trim();

  // Find table context
  const table = element.closest("table");
  const headers = [];
  table.find("thead tr th").each((i, th) => {
    headers.push($(th).text().trim());
  });

  // Find row label (if exists)
  const row = element.closest("tr");
  const firstCell = row.find("td").first().text().trim();

  selectorData.push({
    selector,
    found: true,
    value,
    section: cardHeader,
    tableHeaders: headers.join(" | "),
    rowLabel: firstCell,
  });
});

// Group by section
const grouped = {};
selectorData.forEach(item => {
  if (!item.found) return;
  const section = item.section || "Unknown";
  if (!grouped[section]) grouped[section] = [];
  grouped[section].push(item);
});

// Output analysis
console.log("=".repeat(80));
Object.keys(grouped).sort().forEach(section => {
  console.log(`\nSection: ${section}`);
  console.log("-".repeat(80));
  const items = grouped[section];
  items.slice(0, 5).forEach(item => {
    console.log(`  Row Label: ${item.rowLabel || "N/A"}`);
    console.log(`  Value: "${item.value}"`);
    console.log(`  Headers: ${item.tableHeaders}`);
    console.log();
  });
  if (items.length > 5) {
    console.log(`  ... and ${items.length - 5} more items in this section\n`);
  }
});

// Save detailed analysis to JSON
fs.writeFileSync(
  "../unmapped_analysis.json",
  JSON.stringify(selectorData, null, 2),
  "utf8"
);
console.log("\nDetailed analysis saved to unmapped_analysis.json");
