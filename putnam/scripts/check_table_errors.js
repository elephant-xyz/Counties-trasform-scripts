const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

// Get the 51 table errors from errors.csv
const csv = fs.readFileSync('../../../errors.csv', 'utf8');
const tableErrors = csv.split('\n')
  .slice(1)
  .filter(line => line.includes('table') && line.includes('td') && !line.includes('option[data-tokens'));

console.log(`Found ${tableErrors.length} table cell errors\n`);

// Sample and check first 20
const samples = tableErrors.slice(0, 20);
console.log('Checking first 20 table cell errors:\n');

samples.forEach((line, idx) => {
  const selector = line.split(',')[0].replace(/"/g, '');
  const value = $(selector).first().text().trim();

  console.log(`${idx + 1}. Selector: ${selector.substring(0, 80)}...`);
  console.log(`   Value: "${value}"`);
  console.log(`   Empty? ${!value}\n`);
});

console.log('\n=== Analysis ===');
console.log('Many selectors return empty values or very specific table cells.');
console.log('Need to determine which ones contain extractable property data.');
