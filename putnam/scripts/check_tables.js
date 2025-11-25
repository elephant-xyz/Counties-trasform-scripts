const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/runtime-workdir/scripts/input.html', 'utf8');
const $ = cheerio.load(html);

// Check what's in the specific table cells mentioned in errors
console.log('=== Table data from error selectors ===');
console.log('tr:nth-child(2) > td.text-right:nth-child(2):', $('div.table-wrapper > table.table > tbody > tr:nth-child(2) > td.text-right:nth-child(2)').first().text().trim());
console.log('tr:nth-child(2) > td:nth-child(2):', $('div.table-wrapper > table.table > tbody > tr:nth-child(2) > td:nth-child(2)').first().text().trim());
console.log('tr:nth-child(1) > td:nth-child(2):', $('div.table-wrapper > table.table > tbody > tr:nth-child(1) > td:nth-child(2)').first().text().trim());

// Check taxing authorities table
console.log('\n=== Taxing Authorities table ===');
$('#details-Value .card:contains("Taxing Authorities") table tbody tr.text-nowrap').slice(0, 3).each((i, tr) => {
  const auth = $(tr).find('td').eq(0).text().trim();
  const taxable = $(tr).find('td').eq(6).text().trim();
  console.log(`Row ${i}: Authority=${auth}, Taxable Value=${taxable}`);
});

// Check all form option elements
console.log('\n=== Sample dropdown options ===');
$('select#subdivision option').slice(0, 5).each((i, opt) => {
  console.log(`Option ${i}: value=${$(opt).attr('value')}, text=${$(opt).text().trim()}`);
});
