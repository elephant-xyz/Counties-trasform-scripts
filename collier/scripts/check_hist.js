const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('../input/22430011621.html', 'utf8');
const $ = cheerio.load(html);

function toNum(str) {
  const cleaned = String(str).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

console.log('History selector values:');
for (let i = 2; i <= 5; i++) {
  const totalTaxes = toNum($(`#HistoryTotalTaxes${i}`).text().trim());
  const advTaxes = toNum($(`#HistoryTotalAdvTaxes${i}`).text().trim());
  const nadvTaxes = toNum($(`#HistoryTotalNAdvTaxes${i}`).text().trim());
  console.log(`Year ${i}: TotalTaxes=${totalTaxes}, AdvTaxes=${advTaxes}, NAdvTaxes=${nadvTaxes}`);
}
