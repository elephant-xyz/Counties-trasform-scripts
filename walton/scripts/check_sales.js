const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

function textOf($el) {
  if (!$el || $el.length === 0) return null;
  return $el.text().trim();
}

const SALES_TABLE_SELECTOR = '#ctlBodyPane_ctl12_ctl01_grdSales tbody tr';

const rows = $(SALES_TABLE_SELECTOR);
console.log('Number of sales rows:', rows.length);

const sales = [];
rows.each((i, tr) => {
  const tds = $(tr).find('th, td');
  const saleDate = textOf($(tds[1]));
  console.log(`Sale ${i+1}: date=${saleDate}`);
  sales.push(saleDate);
});

console.log('\nSales:', sales);
