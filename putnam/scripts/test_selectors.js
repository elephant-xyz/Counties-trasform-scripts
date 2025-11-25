const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("../input/85052.html", "utf8");
const $ = cheerio.load(html);

// Test a few selectors from the errors
const selectors = [
  "div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(6) > td.text-center:nth-child(11)",
  "div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(19) > td.text-center:nth-child(8)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(2) > td.text-right:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(3) > td.text-right:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(2) > td.text-center:nth-child(4)",
  "div.card:nth-child(4) > div.card-body > div.row > div.col-12 > span.font-weight-bold:nth-child(2)",
  "div.row:nth-child(1) > div.col-lg-6:nth-child(2) > div.row:nth-child(1) > div.col-8 > div:nth-child(2)",
];

selectors.forEach((selector) => {
  const elements = $(selector);
  console.log(`\n=== Selector: ${selector} ===`);
  console.log(`Found ${elements.length} elements`);
  elements.each((i, el) => {
    const text = $(el).text().trim();
    console.log(`  [${i}] Text: "${text}"`);
    // Get parent context
    const parent = $(el).parent();
    const parentText = parent.text().trim().substring(0, 100);
    console.log(`  [${i}] Parent context: "${parentText}..."`);
  });
});
