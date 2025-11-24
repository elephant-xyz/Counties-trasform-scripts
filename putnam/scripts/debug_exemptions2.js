const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('./input/89029.html', 'utf8');
const $ = cheerio.load(html);

const exemptionsTable = $('#details-Value .card:contains("Exemptions") table');
console.log('=== HEADERS ===');
exemptionsTable.find('thead th').each((i, th) => {
  console.log(`Header ${i}: "${$(th).text().trim()}"`);
});

console.log('\n=== ROWS ===');
exemptionsTable.find('tbody tr').each((i, tr) => {
  const cells = $(tr).find('td');
  console.log(`\nRow ${i+1} (${cells.length} cells):`);
  cells.each((j, td) => {
    const text = $(td).text().trim();
    const colspan = $(td).attr('colspan') || '1';
    console.log(`  Cell ${j} (colspan=${colspan}): "${text.substring(0, 40)}"`);
  });
});
