const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('../../../../input/07-11-31-7026-00030-0220.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== Valuation Table (Table 1) ===');
const valTable = $('table.tabular-data').eq(0);
valTable.find('tbody tr').each((i, tr) => {
  const th = $(tr).find('th').text().trim();
  const tds = [];
  $(tr).find('td.value-column').each((j, td) => {
    tds.push($(td).text().trim());
  });
  console.log('Row ' + (i+1) + ': ' + th + ' => ' + tds.join(' | '));
});

console.log('\n=== Historical Assessment Table (Table 2) ===');
const histTable = $('table.tabular-data').eq(1);
histTable.find('tbody tr').slice(0, 5).each((i, tr) => {
  const th = $(tr).find('th').text().trim();
  const tds = [];
  $(tr).find('td').each((j, td) => {
    tds.push($(td).text().trim());
  });
  console.log('Row ' + (i+1) + ': ' + th + ' => ' + tds.join(' | '));
});

console.log('\n=== Building Area Types Table (Table 3) ===');
const bldgTable = $('table.tabular-data').eq(2);
bldgTable.find('tbody tr').each((i, tr) => {
  const th = $(tr).find('th').text().trim();
  const tds = [];
  $(tr).find('td').each((j, td) => {
    tds.push($(td).text().trim());
  });
  console.log('Row ' + (i+1) + ': ' + th + ' => ' + tds.join(' | '));
});

console.log('\n=== Sales Table Data ===');
const salesTable = $('table.tabular-data').eq(4);
salesTable.find('tbody tr').each((i, tr) => {
  const th = $(tr).find('th').text().trim();
  const tds = [];
  $(tr).find('td').each((j, td) => {
    const text = $(td).text().trim();
    const hasSupp = $(td).find('[id*="Suppressed"]').length > 0;
    tds.push(text + (hasSupp ? ' [SUPPRESSED]' : ''));
  });
  console.log('Sale ' + (i+1) + ': Date=' + th + ' Data: ' + tds.join(' | '));
});
