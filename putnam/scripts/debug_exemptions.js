const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('./input/89029.html', 'utf8');
const $ = cheerio.load(html);

const exemptionsTable = $('#details-Value .card:contains("Exemptions") table');
console.log('Table found:', exemptionsTable.length > 0);

exemptionsTable.find('tbody tr').each((i, tr) => {
  const cells = $(tr).find('td');
  console.log(`Row ${i+1}: ${cells.length} cells`);
  if (cells.length >= 10) {
    const desc = $(cells[7]).text().trim();
    const amount = $(cells[9]).text().trim();
    console.log(`  Col 7 (desc): "${desc}"`);
    console.log(`  Col 9 (amount): "${amount}"`);
    console.log(`  Matches homestead: ${/homestead|exemption/i.test(desc)}`);
  }
});
