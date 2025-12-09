const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('../input/07-11-31-7026-00280-0210.html', 'utf8');
const $ = cheerio.load(html);

// Test some error selectors
const selectors = [
  'div > table.tabular-data > tbody > tr:nth-child(11) > td:nth-child(1)',
  'div.module-content > table.tabular-data > tbody > tr:nth-child(1) > td.value-column:nth-child(1)',
  '#hlkLastUpdated',
  'tbody > tr:nth-child(9) > td > div > span',
  'div > table.tabular-data > tbody > tr:nth-child(6) > td:nth-child(1)'
];

selectors.forEach(sel => {
  const elem = $(sel).first();
  if (elem.length) {
    console.log('Selector:', sel);
    console.log('Text:', elem.text().trim());
    console.log('---');
  } else {
    console.log('Selector:', sel, '- NOT FOUND');
    console.log('---');
  }
});
