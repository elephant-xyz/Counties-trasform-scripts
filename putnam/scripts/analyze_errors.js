const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('./input/89029.html', 'utf8');
const $ = cheerio.load(html);

// Read the errors CSV
const errorsCSV = fs.readFileSync('./errors.csv', 'utf8');
const lines = errorsCSV.split('\n').slice(1); // Skip header

console.log('=== GROUPING ERROR SELECTORS BY TABLE ===\n');

const selectorsByTable = {};

for (const line of lines) {
  if (!line.trim()) continue;
  const selector = line.split(',')[0];

  try {
    const matches = $(selector);
    if (matches.length > 0) {
      matches.each((i, el) => {
        const card = $(el).closest('.card');
        const header = card.find('.card-header').text().trim() || 'Unknown';
        const value = $(el).text().trim().substring(0, 50);

        if (!selectorsByTable[header]) {
          selectorsByTable[header] = [];
        }
        selectorsByTable[header].push({
          selector: selector.substring(0, 80),
          value: value
        });
      });
    }
  } catch (e) {
    // Skip invalid selectors
  }
}

// Print grouped selectors
for (const [table, selectors] of Object.entries(selectorsByTable)) {
  console.log(`\nTable: ${table}`);
  console.log(`  Number of unmapped selectors: ${selectors.length}`);

  // Show unique selectors (first 5)
  const uniqueSelectors = [...new Set(selectors.map(s => s.selector))];
  console.log(`  Unique selectors: ${uniqueSelectors.length}`);
  uniqueSelectors.slice(0, 3).forEach(sel => {
    console.log(`    - ${sel.substring(0, 60)}`);
  });
}
