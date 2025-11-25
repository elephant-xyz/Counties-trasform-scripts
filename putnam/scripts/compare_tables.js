const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== First Summary Table (top of page) ===');
$('.details-card:contains("Summary") .table-wrapper table tbody tr').each((i, row) => {
  const label = $(row).find('td').eq(0).text().trim();
  const value = $(row).find('td').eq(1).text().trim();
  if (label && value) {
    console.log(`${label}: ${value}`);
  }
});

console.log('\n=== Multi-Year Comparison Table (used by script) ===');
const compTable = $('.details-card:contains("Comparison") table');
const headers = [];
compTable.find('thead tr th').each((i, th) => {
  headers.push($(th).text().trim());
});
console.log('Years:', headers.filter(h => /^\d{4}$/.test(h)).join(', '));

console.log('\n=== Which Should Be Used? ===');
console.log('First table: Current year summary values');
console.log('Comparison table: Multiple years for historical comparison');
console.log('Recommendation: Extract BOTH - first table for current year, comparison for historical');
