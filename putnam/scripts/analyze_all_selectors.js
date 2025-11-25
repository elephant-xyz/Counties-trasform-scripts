const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("../input/85052.html", "utf8");
const $ = cheerio.load(html);

// Read all error selectors from CSV
const csv = fs.readFileSync("../errors.csv", "utf8");
const lines = csv.split('\n').slice(1); // Skip header
const selectors = lines
  .filter(line => line.trim())
  .map(line => line.split(',')[0]);

console.log(`Total selectors to analyze: ${selectors.length}\n`);

// Group by table context
const dataByContext = {};

selectors.forEach((selector, idx) => {
  const elements = $(selector);
  if (elements.length > 0) {
    const text = elements.first().text().trim();
    const parent = elements.first().closest('.card');
    const cardHeader = parent.find('.card-header').first().text().trim();

    if (!dataByContext[cardHeader]) {
      dataByContext[cardHeader] = [];
    }

    dataByContext[cardHeader].push({
      selector,
      text,
      count: elements.length
    });
  }
});

// Print grouped results
Object.keys(dataByContext).forEach(context => {
  console.log(`\n=== ${context || 'Unknown Context'} ===`);
  console.log(`Total selectors: ${dataByContext[context].length}`);
  dataByContext[context].slice(0, 5).forEach(item => {
    console.log(`  - Text: "${item.text}" (${item.count} matches)`);
  });
  if (dataByContext[context].length > 5) {
    console.log(`  ... and ${dataByContext[context].length - 5} more`);
  }
});
