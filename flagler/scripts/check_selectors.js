const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../input/07-11-31-7026-00010-0330.html'), 'utf8');
const $ = cheerio.load(html);

console.log('=== Checking specific selectors from errors ===\n');

console.log('1. #hlkLastUpdated:');
console.log($('#hlkLastUpdated').text().trim());
console.log('');

console.log('2. #ctlBodyPane_ctl15_ctl01_grdSales_ctl03_sprGrantor_lblSuppressed:');
console.log($('#ctlBodyPane_ctl15_ctl01_grdSales_ctl03_sprGrantor_lblSuppressed').text().trim());
console.log('');

console.log('3. tbody > tr:nth-child(9) > td > div > span (first):');
const span9 = $('tbody > tr:nth-child(9) > td > div > span').first();
console.log('Text:', span9.text().trim());
console.log('Parent TD:', span9.closest('td').text().trim());
console.log('');

console.log('4. tbody > tr:nth-child(3) > td > div > span (first):');
const span3 = $('tbody > tr:nth-child(3) > td > div > span').first();
console.log('Text:', span3.text().trim());
console.log('Parent TD:', span3.closest('td').text().trim());
console.log('');

console.log('5. div.footer-credits (first):');
console.log($('div.footer-credits').first().text().trim());
console.log('');

console.log('6. Valuation table tbody row 1 th:');
const valTable = $('table[id*=grdValuation]').first();
console.log(valTable.find('tbody > tr:nth-child(1) > th').text().trim());
console.log('');

console.log('7. Checking module-content tables:');
$('div.module-content > table.tabular-data').each((i, table) => {
  const $table = $(table);
  console.log(`Table ${i+1}: ${$table.attr('id') || 'no-id'}`);
  const row1 = $table.find('tbody > tr:nth-child(1)');
  console.log(`  Row 1 TD 1:`, row1.find('td.value-column:nth-child(1)').text().trim());
  console.log(`  Row 1 TD 3:`, row1.find('td.value-column:nth-child(3)').text().trim());
});
