const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

// Find all tables with text-nowrap rows
$('.table-wrapper').each((i, wrapper) => {
  const heading = $(wrapper).prevAll('.card-header').first().text().trim();
  const rowCount = $(wrapper).find('tbody tr.text-nowrap').length;
  if (rowCount > 0) {
    console.log(`\n=== Table ${i+1}: ${heading} ===`);
    console.log(`Rows with text-nowrap: ${rowCount}`);
    
    // Show headers
    const headers = [];
    $(wrapper).find('thead tr th').each((j, th) => {
      headers.push($(th).text().trim());
    });
    console.log('Headers:', headers.join(' | '));
    
    // Show first row
    const firstRow = $(wrapper).find('tbody tr.text-nowrap').first();
    const cells = [];
    firstRow.find('td').each((j, td) => {
      cells.push($(td).text().trim());
    });
    console.log('First row:', cells.join(' | '));
  }
});
