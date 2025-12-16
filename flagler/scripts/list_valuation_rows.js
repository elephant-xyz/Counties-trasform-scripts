const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../input/07-11-31-7026-00010-0330.html'), 'utf8');
const $ = cheerio.load(html);

const table = $('table[id*=grdValuation]').first();
console.log('=== All rows in valuation table ===\n');
table.find('tbody tr').each((i, tr) => {
  const label = $(tr).find('th').first().text().trim();
  const values = [];
  $(tr).find('td.value-column').each((_, td) => {
    values.push($(td).text().trim());
  });
  console.log(`Row ${i+1}: ${label}`);
  console.log(`  Values: ${values.join(', ')}`);
  console.log('');
});
