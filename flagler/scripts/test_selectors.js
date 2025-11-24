const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");

// Read HTML
const html = fs.readFileSync("/tmp/runtime-workdir/input/14-11-31-0200-00000-0010.html", "utf8");
const $ = cheerio.load(html);

// Error selectors from errors.csv
const selectors = [
  "#ctlBodyPane_ctl00_ctl01_lstPrimaryOwner_ctl00_sprPrimaryOwnerAddress_lblSuppressed",
  "#ctlBodyPane_ctl15_ctl01_grdSales_ctl36_sprBook_lblSuppressed",
  "tbody > tr:nth-child(9) > td > div > span",
  "div > table.tabular-data > tbody > tr:nth-child(1) > th",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(1) > td.value-column:nth-child(2)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(2) > td.value-column:nth-child(1)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(2) > td.value-column:nth-child(2)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(2) > td.value-column:nth-child(5)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(10) > td.value-column:nth-child(1)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(10) > td.value-column:nth-child(2)",
  "div.module-content > table.tabular-data > tbody > tr:nth-child(10) > td.value-column:nth-child(3)",
  "#aLinkedIn",
  "tbody > tr:nth-child(4) > td > div:nth-child(1) > span",
  "div > table.tabular-data > tbody > tr:nth-child(9) > th",
];

console.log("Testing selectors from errors.csv:\n");

selectors.forEach((selector) => {
  const elements = $(selector);
  console.log(`Selector: ${selector}`);
  console.log(`  Count: ${elements.length}`);
  if (elements.length > 0) {
    console.log(`  First match text: ${elements.first().text().trim().substring(0, 100)}`);
    console.log(`  Context: ${elements.first().parent().attr('id') || elements.first().parent().attr('class') || 'N/A'}`);
  }
  console.log();
});
