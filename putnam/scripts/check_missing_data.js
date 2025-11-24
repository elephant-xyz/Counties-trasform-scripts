const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/runtime-workdir/input/89029.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== SECTIONS IN HTML ===');
console.log('Main sections (tabs):');
$('.parcelDetails .tab-pane').each((i, el) => {
  const id = $(el).attr('id');
  console.log(`  - ${id}`);
});

console.log('\n=== TAXING AUTHORITIES TABLE ===');
const taxTable = $('#details-Value .card:contains("Taxing Authorities") table');
console.log('Taxing Authorities table found:', taxTable.length > 0);
if (taxTable.length > 0) {
  console.log('Sample row:');
  const firstRow = taxTable.find('tbody tr').first();
  const authority = firstRow.find('td').eq(0).text().trim();
  const deferred = firstRow.find('td').eq(1).text().trim();
  const assessed = firstRow.find('td').eq(2).text().trim();
  console.log(`  Authority: ${authority}, Deferred: ${deferred}, Assessed: ${assessed}`);
}

console.log('\n=== EXEMPTIONS TABLE ===');
const exemptionsTable = $('#details-Value .card:contains("Exemptions") table');
console.log('Exemptions table found:', exemptionsTable.length > 0);
if (exemptionsTable.length > 0) {
  console.log('Sample row:');
  const firstRow = exemptionsTable.find('tbody tr').first();
  const desc = firstRow.find('td').eq(0).text().trim();
  const granted = firstRow.find('td').eq(1).text().trim();
  const amount = firstRow.find('td').eq(2).text().trim();
  console.log(`  Description: ${desc}, Granted: ${granted}, Amount: ${amount}`);
}

console.log('\n=== FEATURES TAB ===');
const featuresTable = $('#details-Features table');
console.log('Features table found:', featuresTable.length > 0);
if (featuresTable.length > 0) {
  console.log('Number of rows:', featuresTable.find('tbody tr').length);
  console.log('Sample row:');
  const firstRow = featuresTable.find('tbody tr').first();
  const desc = firstRow.find('td').eq(0).text().trim();
  const sqft = firstRow.find('td').eq(3).text().trim();
  console.log(`  Description: ${desc}, Sq Ft: ${sqft}`);
}

console.log('\n=== ZONING ===');
const zoningCard = $('#details-Land .card:contains("Zoning")');
console.log('Zoning card found:', zoningCard.length > 0);
if (zoningCard.length > 0) {
  const zoningTable = zoningCard.find('table tbody tr').first();
  const code = zoningTable.find('td').eq(1).text().trim();
  const desc = zoningTable.find('td').eq(2).text().trim();
  console.log(`  Code: ${code}, Description: ${desc}`);
}

console.log('\n=== NON-AD VALOREM ASSESSMENTS ===');
const nonAdCard = $('#details-Value .card:contains("Non-Ad Valorem")');
console.log('Non-Ad Valorem card found:', nonAdCard.length > 0);

console.log('\n=== FUTURE LAND USE MAP ===');
const flumCard = $('#details-Land .card:contains("Future Land Use")');
console.log('FLUM card found:', flumCard.length > 0);
