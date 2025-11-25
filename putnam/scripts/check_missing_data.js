const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

console.log("=== Checking critical table data ===\n");

// Error line 2: div.table-wrapper > table.table > tbody > tr.text-nowrap:nth-child(2) > td.text-center:nth-child(13)
console.log("1. Taxing authorities table - column 13 (Taxable Value?):");
$('.table-wrapper table tbody tr.text-nowrap').slice(1,4).each((i, row) => {
  const authority = $(row).find('td').eq(0).text().trim();
  const col13 = $(row).find('td').eq(12).text().trim();
  console.log(`   ${authority}: ${col13}`);
});

console.log("\n2. Checking exemptions table:");
const exemptionTable = $('.table-wrapper table').filter((i, table) => {
  return $(table).find('thead th:contains("Description")').length > 0 &&
         $(table).find('thead th:contains("Granted")').length > 0;
});
exemptionTable.find('tbody tr.text-nowrap').each((i, row) => {
  const desc = $(row).find('td').eq(0).text().trim();
  const granted = $(row).find('td').eq(1).text().trim();
  const amount = $(row).find('td').eq(2).text().trim();
  console.log(`   ${desc}: granted ${granted}, amount ${amount}`);
});

console.log("\n3. Checking improvements table:");
const improvementsSection = $('#improvements-accordion');
improvementsSection.find('table tbody tr.text-nowrap').slice(0, 5).each((i, row) => {
  const desc = $(row).find('td').eq(0).text().trim();
  const val1 = $(row).find('td').eq(1).text().trim();
  const val2 = $(row).find('td').eq(2).text().trim();
  console.log(`   ${desc}: ${val1} | ${val2}`);
});

console.log("\n4. Checking land detail table:");
$('#details-Land .table-wrapper table tbody tr.text-nowrap').slice(0, 5).each((i, row) => {
  const line = $(row).find('td').eq(0).text().trim();
  const landUse = $(row).find('td').eq(1).text().trim();
  console.log(`   Line ${line}: ${landUse}`);
});
