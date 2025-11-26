const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Minimal implementation to trace company creation
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

// Check for sales section
let salesTable = null;
$("section").each((_, section) => {
  if (salesTable) return;
  const title = $(section).find("div.title").first().text().trim().toLowerCase();
  console.log('Section title:', title);
  if (title === "sales") {
    console.log('Found Sales section!');
    const candidate = $(section).find("table").first();
    if (candidate && candidate.length) {
      salesTable = candidate;
      console.log('Found sales table');
    }
  }
});

if (!salesTable || !salesTable.length) {
  console.log('No sales table found');
}

// Check owners data
const ownersPath = './owners/owner_data.json';
if (fs.existsSync(ownersPath)) {
  const ownersData = JSON.parse(fs.readFileSync(ownersPath, 'utf-8'));
  console.log('Owners data:', JSON.stringify(ownersData, null, 2).substring(0, 500));
}
