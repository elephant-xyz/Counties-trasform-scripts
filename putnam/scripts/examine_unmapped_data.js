const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('./input/89029.html', 'utf8');
const $ = cheerio.load(html);

console.log('=== DETAILED EXAMINATION OF UNMAPPED DATA ===\n');

// 1. Comparison Table - what rows are NOT being extracted?
console.log('1. COMPARISON TABLE (currently extracts only 3 rows):');
const compTable = $('#details-Value .card:contains("Comparison") table');
compTable.find('tbody tr').each((i, tr) => {
  const label = $(tr).find('td').eq(0).text().trim();
  const val2026 = $(tr).find('td').eq(1).text().trim();
  const isExtracted = /Just Value of Land|Improvement Value|Market Value/i.test(label);
  console.log(`  Row ${i+1}: ${label} = ${val2026} [${isExtracted ? 'EXTRACTED' : 'NOT EXTRACTED'}]`);
});

// 2. Taxing Authorities Table
console.log('\n2. TAXING AUTHORITIES TABLE (not extracted):');
const taxAuthTable = $('#details-Value .card:contains("Taxing Authorities") table');
const taxHeaders = [];
taxAuthTable.find('thead th').each((i, th) => {
  taxHeaders.push($(th).text().trim());
});
console.log(`  Headers: ${taxHeaders.join(' | ')}`);
taxAuthTable.find('tbody tr').slice(0, 2).each((i, tr) => {
  const cols = [];
  $(tr).find('td').each((j, td) => {
    cols.push($(td).text().trim());
  });
  console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
});

// 3. Exemptions Table
console.log('\n3. EXEMPTIONS TABLE (not extracted):');
const exempTable = $('#details-Value .card:contains("Exemptions") table');
const exempHeaders = [];
exempTable.find('thead th').each((i, th) => {
  exempHeaders.push($(th).text().trim());
});
console.log(`  Headers: ${exempHeaders.join(' | ')}`);
exempTable.find('tbody tr').slice(0, 2).each((i, tr) => {
  const cols = [];
  $(tr).find('td').each((j, td) => {
    cols.push($(td).text().trim());
  });
  console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
});

// 4. Non-Ad Valorem Table
console.log('\n4. NON-AD VALOREM TABLE (not extracted):');
const nonAdTable = $('#details-Value .card:contains("Non-Ad Valorem") table');
nonAdTable.find('tbody tr').slice(0, 3).each((i, tr) => {
  const cols = [];
  $(tr).find('td').each((j, td) => {
    cols.push($(td).text().trim());
  });
  console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
});

// 5. Land Table - what columns are NOT being extracted?
console.log('\n5. LAND TABLE (currently extracts only Units/acres):');
const landTable = $('#details-Land .card:contains("Land") table');
const landHeaders = [];
landTable.find('thead th').each((i, th) => {
  landHeaders.push($(th).text().trim());
});
console.log(`  Headers: ${landHeaders.join(' | ')}`);
const landRow = landTable.find('tbody tr').first();
const landCols = [];
landRow.find('td').each((i, td) => {
  landCols.push($(td).text().trim());
});
console.log(`  First row: ${landCols.join(' | ')}`);

// 6. FLUM Table
console.log('\n6. FUTURE LAND USE MAP (not extracted):');
const flumTable = $('#details-Land .card:contains("Future Land Use") table tbody tr').first();
if (flumTable.length > 0) {
  const code = flumTable.find('td').eq(1).text().trim();
  const desc = flumTable.find('td').eq(2).text().trim();
  console.log(`  Code: ${code}, Description: ${desc}`);
}

// 7. Outbuildings Table
console.log('\n7. OUTBUILDINGS AND EXTRA FEATURES TABLE:');
const outTable = $('#details-Features table');
const outHeaders = [];
outTable.find('thead th').each((i, th) => {
  outHeaders.push($(th).text().trim());
});
console.log(`  Headers: ${outHeaders.join(' | ')}`);
console.log(`  Total rows: ${outTable.find('tbody tr').length}`);
outTable.find('tbody tr').slice(0, 2).each((i, tr) => {
  const cols = [];
  $(tr).find('td').each((j, td) => {
    cols.push($(td).text().trim());
  });
  console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
});

// 8. Tax Cap Tables
console.log('\n8. TAX CAP - HOMESTEAD TABLE:');
const homesteadTable = $('#details-TaxCap .card:contains("Homestead") table');
if (homesteadTable.length > 0) {
  const homeHeaders = [];
  homesteadTable.find('thead th').each((i, th) => {
    homeHeaders.push($(th).text().trim());
  });
  console.log(`  Headers: ${homeHeaders.join(' | ')}`);
  homesteadTable.find('tbody tr').slice(0, 2).each((i, tr) => {
    const cols = [];
    $(tr).find('td').each((j, td) => {
      cols.push($(td).text().trim());
    });
    console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
  });
}

// 9. Area and Additions tables (in improvements)
console.log('\n9. AREA AND ADDITIONS TABLES (in improvements):');
const areaAddTables = $('#improvements-accordion .card:contains("Area and Additions") table');
console.log(`  Number of Area and Additions tables: ${areaAddTables.length}`);
if (areaAddTables.length > 0) {
  const firstTable = areaAddTables.first();
  const areaHeaders = [];
  firstTable.find('thead th').each((i, th) => {
    areaHeaders.push($(th).text().trim());
  });
  console.log(`  Headers: ${areaHeaders.join(' | ')}`);
  firstTable.find('tbody tr').slice(0, 2).each((i, tr) => {
    const cols = [];
    $(tr).find('td').each((j, td) => {
      cols.push($(td).text().trim());
    });
    console.log(`  Row ${i+1}: ${cols.join(' | ')}`);
  });
}
