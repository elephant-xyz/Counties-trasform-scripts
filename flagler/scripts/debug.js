const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('07-11-31-7011-00030-0180.html', 'utf8');
const $ = cheerio.load(html);
const table = $("table[id*='grdValuation']").first();
const rowMap = new Map();
table.find('tbody tr').each((i, tr) => {
  const label = $(tr).find('th').first().text().trim();
  if (!label) return;
  const values = [];
  $(tr).find('td.value-column').each((_, td) => values.push($(td).text().trim()));
  rowMap.set(label.trim().toLowerCase(), values);
  if (i < 3) {
    console.log(`Row ${i}: "${label}" -> "${label.trim().toLowerCase()}"`, values.slice(0, 2));
  }
});
console.log('\nKeys in rowMap:');
for (const key of rowMap.keys()) {
  if (key.includes('building') || key.includes('improvement')) {
    console.log(' -', key, ':', rowMap.get(key).slice(0, 2));
  }
}
