const fs = require("fs");
const cheerio = require("cheerio");

const path = require("path");
const htmlPath = path.join(__dirname, "..", "input", "91457.html");
const html = fs.readFileSync(htmlPath, "utf8");
const $ = cheerio.load(html);

const selectors = [
  "div.table-wrapper > table.table > tbody > tr.text-nowrap > td.text-center:nth-child(8)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(17) > td:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(1) > td:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(2) > td:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr.text-nowrap > td.text-center:nth-child(2)",
  "div.table-wrapper > table.table > thead > tr > th.text-right:nth-child(2)",
  "div.table-wrapper > table.table > thead > tr > th.text-right:nth-child(4)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(5) > td:nth-child(2)",
  "div.card:nth-child(4) > div.card-body > div.row > div.col-12 > span.font-weight-bold:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(6) > td:nth-child(1)"
];

selectors.forEach((selector, i) => {
  console.log(`\n=== Selector ${i + 1}: ${selector} ===`);
  const elements = $(selector);
  console.log(`Found ${elements.length} elements`);
  elements.each((idx, el) => {
    const text = $(el).text().trim();
    const parent = $(el).parent();
    const parentText = parent.text().trim();
    console.log(`Element ${idx + 1}: "${text}"`);
    console.log(`Parent row context: "${parentText.substring(0, 150)}..."`);
  });
});
