const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl07_ctl01_grdSales_grdFlat tbody tr";
const rows = $(SALES_TABLE_SELECTOR);

console.log("Found " + rows.length + " sales rows");

rows.each((i, tr) => {
  const tds = $(tr).find("th, td");
  const saleDate = $(tds[0]).text().trim();
  const grantor = $(tds[7]).text().trim();
  const grantee = $(tds[8]).text().trim();
  console.log("\nSale " + (i + 1) + ":");
  console.log("  Date: " + saleDate);
  console.log("  Grantor: " + grantor);
  console.log("  Grantee: " + grantee);
});
