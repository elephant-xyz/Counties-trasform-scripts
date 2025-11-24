const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/runtime-workdir/input/89029.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== COMPREHENSIVE DATA ANALYSIS ===\n');

console.log('1. OPTION ELEMENTS (Search Form UI):');
console.log('   - ALL option[data-tokens] are in .parcelSearch section');
console.log('   - These are search form dropdowns (subdivisions, cities, land use codes)');
console.log('   - NOT property data - FALSE POSITIVE ERRORS\n');

console.log('2. COMPARISON TABLE (Partial Extraction):');
const compTable = $('#details-Value .card:contains("Comparison") table');
compTable.find('tbody tr').each((i, tr) => {
  const label = $(tr).find('td').eq(0).text().trim();
  const isExtracted = /Just Value of Land|Improvement Value|Market Value/i.test(label);
  console.log(`   - ${label}: ${isExtracted ? 'EXTRACTED' : 'NOT EXTRACTED'}`);
});

console.log('\n3. TAXING AUTHORITIES TABLE:');
const taxTable = $('#details-Value .card:contains("Taxing Authorities") table');
console.log(`   - Found: ${taxTable.length > 0}`);
console.log(`   - Rows: ${taxTable.find('tbody tr').length}`);
console.log('   - Status: NOT EXTRACTED');
console.log('   - Contains: Deferred Value, Assessed Value, Classified Land, Exemptions, Taxable Value per authority');

console.log('\n4. EXEMPTIONS TABLE:');
const exemptionsTable = $('#details-Value .card:contains("Exemptions") table');
console.log(`   - Found: ${exemptionsTable.length > 0}`);
console.log(`   - Rows: ${exemptionsTable.find('tbody tr').length}`);
console.log('   - Status: NOT EXTRACTED');
console.log('   - Contains: Description, Granted year, Amount, Remainder, Owner %, Applicable To');

console.log('\n5. LAND TABLE:');
const landTable = $('#details-Land .card:contains("Land") table');
console.log(`   - Found: ${landTable.length > 0}`);
console.log(`   - Rows: ${landTable.find('tbody tr').length}`);
console.log('   - Status: PARTIALLY EXTRACTED (only Units/acres)');
console.log('   - Missing: Unit prices, adjusted prices, depth factors, condition codes');

console.log('\n6. FEATURES TABLE (Outbuildings):');
const featuresTable = $('#details-Features table');
console.log(`   - Found: ${featuresTable.length > 0}`);
console.log(`   - Rows: ${featuresTable.find('tbody tr').length}`);
console.log('   - Status: PARTIALLY EXTRACTED (used by layout/utility scripts)');

console.log('\n7. ZONING:');
const zoningTable = $('#details-Land .card:contains("Zoning") table tbody tr').first();
if (zoningTable.length > 0) {
  const code = zoningTable.find('td').eq(1).text().trim();
  const desc = zoningTable.find('td').eq(2).text().trim();
  console.log(`   - Found: ${zoningTable.length > 0}`);
  console.log(`   - Status: EXTRACTED`);
  console.log(`   - Value: ${code} - ${desc}`);
}

console.log('\n8. FUTURE LAND USE MAP:');
const flumTable = $('#details-Land .card:contains("Future Land Use") table tbody tr').first();
if (flumTable.length > 0) {
  const code = flumTable.find('td').eq(1).text().trim();
  const desc = flumTable.find('td').eq(2).text().trim();
  console.log(`   - Found: ${flumTable.length > 0}`);
  console.log(`   - Status: NOT EXTRACTED`);
  console.log(`   - Value: ${code} - ${desc}`);
}

console.log('\n9. SALES TABLE:');
const salesTable = $('#details-Sales table tbody tr');
console.log(`   - Found: ${salesTable.length > 0}`);
console.log(`   - Rows: ${salesTable.length}`);
console.log('   - Status: EXTRACTED (book, page, instrument, date, price)');

console.log('\n10. IMPROVEMENTS (Buildings):');
const improvements = $('#improvements-accordion .card.wrapper-card');
console.log(`   - Found: ${improvements.length} buildings`);
console.log('   - Status: EXTRACTED via layoutMapping.js, structureMapping.js, utilityMapping.js');

console.log('\n11. SUMMARY CARD DATA:');
const summaryCard = $('.parcelDetails .summary-card');
const vid = summaryCard.find('.row').filter((i, el) => $(el).find('.col-4').text().includes('VID:')).find('.col-8').text().trim();
const owner = summaryCard.find('.row').filter((i, el) => $(el).find('.col-4').text().includes('Owner:')).find('.col-8').text().trim();
const address = summaryCard.find('.row').filter((i, el) => $(el).find('.col-4').text().includes('911')).find('.col-8').text().trim();
console.log(`   - VID: ${vid ? 'EXTRACTED' : 'NOT FOUND'}`);
console.log(`   - Owner: ${owner ? 'EXTRACTED' : 'NOT FOUND'}`);
console.log(`   - 911 Address: ${address ? 'EXTRACTED' : 'NOT FOUND'}`);
console.log(`   - Legal Description: EXTRACTED`);

console.log('\n12. TAX CAP SECTION:');
const taxCapSection = $('#details-TaxCap');
console.log(`   - Found: ${taxCapSection.length > 0}`);
console.log('   - Status: NOT EXTRACTED');
console.log('   - Contains: Homestead and Non-Homestead cap details');
