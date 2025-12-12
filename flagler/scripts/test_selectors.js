const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('../../../../input/07-11-31-7026-00030-0220.html', 'utf8');
const $ = cheerio.load(html);

const selectors = [
  'div > table.tabular-data > tbody > tr:nth-child(11) > td:nth-child(1)',
  'tbody > tr:nth-child(9) > td > div > span',
  'div > table.tabular-data > tbody > tr:nth-child(1) > th',
  'div.module-content > table.tabular-data > tbody > tr:nth-child(1) > td.value-column:nth-child(1)',
  '#hlkLastUpdated',
  '#ctlBodyPane_ctl15_ctl01_grdSales_ctl03_sprGrantor_lblSuppressed'
];

selectors.forEach(sel => {
  const elem = $(sel).first();
  if (elem.length) {
    console.log('Found:', sel);
    console.log('  Text:', elem.text().trim().substring(0, 80));
    console.log('---');
  } else {
    console.log('NOT FOUND:', sel);
  }
});

console.log('\nTables with tabular-data class:');
$('table.tabular-data').each((i, table) => {
  const section = $(table).closest('section');
  const titleElem = section.find('.title').first();
  const title = titleElem.text().trim();
  console.log('Table ' + (i+1) + ': ' + (title || 'No title'));
  console.log('  Rows: ' + $(table).find('tbody tr').length);
});
