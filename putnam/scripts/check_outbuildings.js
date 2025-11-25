const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input/78506.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== Checking for Outbuildings tables ===');
const cards = $('#improvements-accordion .card');
let foundOutbuildings = false;
cards.each((_, cardEl) => {
  const card = $(cardEl);
  const cardHeader = $(card).find('.card-header').text().trim();
  if (/Outbuildings|Extra Features/i.test(cardHeader)) {
    console.log('Found card:', cardHeader);
    foundOutbuildings = true;
    const table = $(card).find('table').first();
    if (table.length) {
      console.log('Table found, rows:', table.find('tbody tr').length);
      console.log('Text-nowrap rows:', table.find('tbody tr.text-nowrap').length);
      table.find('tbody tr').slice(0, 3).each((i, tr) => {
        const tds = $(tr).find('td');
        console.log(`Row ${i+1} cells: ${tds.length}`);
        if (tds.length > 0) {
          console.log(`  Cell 0: ${$(tds[0]).text().trim()}`);
          console.log(`  Cell 1: ${$(tds[1]).text().trim()}`);
        }
      });
    } else {
      console.log('No table found');
    }
  }
});

if (foundOutbuildings === false) {
  console.log('No outbuildings cards found. Checking all card headers:');
  cards.each((_, cardEl) => {
    const header = $(cardEl).find('.card-header').text().trim();
    if (header) console.log(`  - ${header}`);
  });
}
