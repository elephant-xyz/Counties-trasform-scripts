const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

// Search for owner-related text
$('*').each((i, el) => {
  const text = $(el).text().trim();
  if (text.toLowerCase().includes('owner') && text.length < 100) {
    console.log('Owner text:', text);
  }
});

// Look for tables with owner data
$('table').each((i, table) => {
  const tableText = $(table).text();
  if (tableText.toLowerCase().includes('owner')) {
    console.log('\n--- Table with Owner ---');
    console.log($(table).html().substring(0, 500));
  }
});
