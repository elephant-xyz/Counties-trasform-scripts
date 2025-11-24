const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('../input/14-11-31-0200-00000-0010.html', 'utf-8');
const $ = cheerio.load(html);

// Check valuation table
const table = $('#ctlBodyPane_ctl05_ctl01_grdValuation');
console.log('Valuation table found:', table.length);

// Count header columns - including the first empty td
const headerCols = table.find('thead tr td, thead tr th');
console.log('Header columns (all):', headerCols.length);

// Count body rows
const bodyRows = table.find('tbody tr');
console.log('Body rows:', bodyRows.length);

// List each row with all cells
bodyRows.each((i, tr) => {
  const thCell = $(tr).find('th');
  const label = thCell.text().trim();
  const tdCells = $(tr).find('td.value-column');
  console.log(`Row ${i+1}: "${label}" - ${tdCells.length} value cells`);
  tdCells.each((j, td) => {
    console.log(`  Cell ${j+1}: "${$(td).text().trim()}"`);
  });
});

// Check what the module-content selector pattern matches
const moduleContentTables = $('div.module-content > table.tabular-data');
console.log('\nmodule-content tables found:', moduleContentTables.length);
