const fs = require("fs");
const cheerio = require("cheerio");

const html = fs.readFileSync("../input/91198.html", "utf8");
const $ = cheerio.load(html);

// Test a few selectors from the error list
const selectors = [
  "div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(6) > td.text-center:nth-child(4)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(2) > td.text-right:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(3) > td.text-right:nth-child(2)",
  "div.table-wrapper > table.table > tbody > tr:nth-child(1) > td:nth-child(2)",
  "div.card:nth-child(4) > div.card-body > div.row > div.col-12 > span.font-weight-bold:nth-child(2)",
];

console.log("Testing selectors:");
selectors.forEach(selector => {
  const element = $(selector).first();
  if (element.length > 0) {
    const text = element.text().trim();
    const parent = element.parent();
    const parentText = parent.text().trim().substring(0, 100);
    console.log(`\nSelector: ${selector}`);
    console.log(`  Value: "${text}"`);
    console.log(`  Parent context: "${parentText}..."`);
  } else {
    console.log(`\nSelector: ${selector}`);
    console.log(`  NOT FOUND`);
  }
});

// Let's also check what tables exist
console.log("\n\n=== All tables with .table-wrapper ===");
$("div.table-wrapper").each((i, wrapper) => {
  const cardHeader = $(wrapper).closest(".card").find(".card-header").first().text().trim();
  const tableHeaders = [];
  $(wrapper).find("table thead tr th").each((j, th) => {
    tableHeaders.push($(th).text().trim());
  });
  console.log(`\nTable ${i + 1}:`);
  console.log(`  Section: ${cardHeader}`);
  console.log(`  Headers: ${tableHeaders.join(" | ")}`);
});
