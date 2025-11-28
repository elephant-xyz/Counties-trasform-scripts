const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

const SALES_TABLE_SELECTOR = "#ctlBodyPane_ctl11_ctl01_grdSales tbody tr";
const rows = $(SALES_TABLE_SELECTOR);

console.log('Found rows:', rows.length);

rows.each((i, tr) => {
  const tds = $(tr).find("th, td");
  const saleDate = $(tds[0]).text().trim();
  const salePrice = $(tds[1]).text().trim();
  const instrument = $(tds[2]).text().trim();
  const bookPage = $(tds[3]).text().trim();

  console.log(`Row ${i}: Date=${saleDate}, Price=${salePrice}, Instrument="${instrument}", Book/Page=${bookPage}`);
});
