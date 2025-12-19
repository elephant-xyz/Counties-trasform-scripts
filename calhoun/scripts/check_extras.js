const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);
const table = $('#ctlBodyPane_ctl05_ctl01_grdSales_grdFlat');
console.log('Extra features found:');
table.find('tbody tr').each((_, tr) => {
  const cells = $(tr).children();
  const code = $(cells[0]).text().trim();
  const description = $(cells[1]).text().trim();
  const dimensions = $(cells[2]).text().trim();
  const units = $(cells[3]).text().trim();
  const year = $(cells[4]).text().trim();
  console.log(JSON.stringify({ code, description, dimensions, units, year }));
});
