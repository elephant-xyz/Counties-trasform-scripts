const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== Summary Table (left side) ===');
$('div.table-wrapper table.table').first().find('tbody tr').each((i, tr) => {
  const label = $(tr).find('td').eq(0).text().trim();
  const value = $(tr).find('td').eq(1).text().trim();
  console.log(`${i+1}. ${label} => ${value}`);
});

console.log('\n=== Summary Table (right side) ===');
$('div.table-wrapper table.table').eq(1).find('tbody tr').each((i, tr) => {
  const label = $(tr).find('td').eq(0).text().trim();
  const value = $(tr).find('td').eq(1).text().trim();
  console.log(`${i+1}. ${label} => ${value}`);
});

console.log('\n=== Are these values already being extracted? ===');
console.log('Script extracts from Comparison table for tax data');
console.log('Script extracts Property Use from Summary table');
console.log('Script extracts yearBuilt from improvements section');
console.log('Script extracts zoning from Land section');
console.log('Script extracts lot acres from Land section');
