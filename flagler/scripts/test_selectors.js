const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../input/14-11-31-0200-00000-0010.html'), 'utf8');
const $ = cheerio.load(html);

// Check the error selectors
console.log('Checking error selectors:');
console.log('1. tbody > tr:nth-child(9) > td > div > span:', $('tbody > tr:nth-child(9) > td > div > span').length);
console.log('   Text:', $('tbody > tr:nth-child(9) > td > div > span').first().text().trim().substring(0, 50));

console.log('\n2. div > table.tabular-data > tbody > tr:nth-child(1) > th:', $('div > table.tabular-data > tbody > tr:nth-child(1) > th').length);
if ($('div > table.tabular-data > tbody > tr:nth-child(1) > th').length > 0) {
  console.log('   First text:', $('div > table.tabular-data > tbody > tr:nth-child(1) > th').first().text().trim());
}

console.log('\n3. div.module-content > table.tabular-data:', $('div.module-content > table.tabular-data').length);

console.log('\n4. div > table.tabular-data > tbody > tr:nth-child(6) > td:nth-child(2):', $('div > table.tabular-data > tbody > tr:nth-child(6) > td:nth-child(2)').length);
if ($('div > table.tabular-data > tbody > tr:nth-child(6) > td:nth-child(2)').length > 0) {
  console.log('   Text:', $('div > table.tabular-data > tbody > tr:nth-child(6) > td:nth-child(2)').first().text().trim());
}

// Look for building data section
const buildingSections = $('section').filter((i, el) => $(el).find('.module-header .title').text().includes('Building'));
console.log('\n5. Building sections found:', buildingSections.length);

// Check for building left/right column divs
const leftDivs = $('div[id*="dynamicBuildingDataLeftColumn"]');
const rightDivs = $('div[id*="dynamicBuildingDataRightColumn"]');
console.log('   Building left column divs:', leftDivs.length);
console.log('   Building right column divs:', rightDivs.length);

// Check valuation table
console.log('\n6. Valuation table: #ctlBodyPane_ctl05_ctl01_grdValuation:', $('#ctlBodyPane_ctl05_ctl01_grdValuation').length);

// Check if there are building tables with th or td in first row
$('div[id*="dynamicBuildingDataLeftColumn"]').each((i, div) => {
  const rows = $(div).find('table tbody tr');
  console.log(`\n   Left column building ${i + 1} has ${rows.length} rows`);
  if (rows.length > 0) {
    const firstRow = rows.eq(0);
    console.log(`     First row has ${firstRow.find('th').length} th and ${firstRow.find('td').length} td`);
  }
});
