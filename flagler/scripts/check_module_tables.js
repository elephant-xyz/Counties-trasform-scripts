const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../input/07-11-31-7026-00010-0330.html'), 'utf8');
const $ = cheerio.load(html);

console.log('=== Checking div.module-content tables ===\n');

// Find all tables that match the error selector pattern
const tables = $('div.module-content > table.tabular-data');
console.log(`Found ${tables.length} tables with this pattern\n`);

tables.each((i, table) => {
  const $table = $(table);
  const tableId = $table.attr('id') || 'no-id';
  console.log(`\n=== Table ${i+1}: ${tableId} ===`);

  // Check rows mentioned in errors
  const errorRows = [1, 2];
  errorRows.forEach(rowNum => {
    const row = $table.find(`tbody > tr:nth-child(${rowNum})`);
    if (row.length > 0) {
      console.log(`\nRow ${rowNum}:`);
      console.log(`  TH: "${row.find('th').text().trim()}"`);

      // Check various td positions mentioned in errors
      [1, 2, 3, 4, 5].forEach(colNum => {
        const td = row.find(`td.value-column:nth-child(${colNum})`);
        if (td.length > 0) {
          console.log(`  TD ${colNum}: "${td.text().trim()}"`);
        }
      });
    }
  });
});

// Also check the specific selector from errors
console.log('\n\n=== Direct selector check ===');
console.log('div.module-content > table.tabular-data > tbody > tr:nth-child(1) > td.value-column:nth-child(1):');
const cell = $('div.module-content > table.tabular-data > tbody > tr:nth-child(1) > td.value-column:nth-child(1)').first();
console.log(`Text: "${cell.text().trim()}"`);

// Check what section/title this table is in
const section = cell.closest('section');
if (section.length > 0) {
  const title = section.find('.title').first().text().trim();
  console.log(`Section title: "${title}"`);
}
