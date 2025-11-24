const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/runtime-workdir/input/89029.html', 'utf8');
const $ = cheerio.load(html);

// Check if selector is in search section or details section
const searchSection = $('.parcelSearch');
const detailsSection = $('.parcelDetails');

console.log('=== CHECKING OPTION ELEMENTS ===');
const optionsInSearch = searchSection.find('option[data-tokens]').length;
const optionsInDetails = detailsSection.find('option[data-tokens]').length;
console.log('Options in search section:', optionsInSearch);
console.log('Options in details section:', optionsInDetails);

console.log('\n=== CHECKING TABLE SELECTORS ===');
const selector1 = 'div.table-wrapper > table.table > tbody > tr:nth-child(3) > td.text-right:nth-child(2)';
const matches1 = $(selector1);
console.log('Matches for tr:nth-child(3) td:nth-child(2):', matches1.length);
matches1.each((i, el) => {
  const text = $(el).text().trim();
  const table = $(el).closest('.card');
  const header = table.find('.card-header').text().trim();
  console.log('  - Table:', header, 'Value:', text);
});

console.log('\n=== CHECKING WHAT TABLES EXIST IN DETAILS ===');
detailsSection.find('.card-header').each((i, el) => {
  const header = $(el).text().trim();
  if (header) {
    console.log('  - Card:', header);
  }
});

console.log('\n=== CHECKING COMPARISON TABLE ROWS ===');
const compTable = $('#details-Value .card:contains("Comparison") table');
console.log('Comparison table found:', compTable.length > 0);
compTable.find('tbody tr').each((i, tr) => {
  const label = $(tr).find('td').eq(0).text().trim();
  const val2026 = $(tr).find('td').eq(1).text().trim();
  console.log(`  Row ${i+1}: ${label} = ${val2026}`);
});
