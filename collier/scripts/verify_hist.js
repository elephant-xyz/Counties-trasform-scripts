const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'input', '22430011621.html'), 'utf8');
const $ = cheerio.load(html);

function toNum(str) {
  const cleaned = String(str).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

console.log('Historical selector values from HTML:');
for (let i = 2; i <= 5; i++) {
  const totalTaxes = toNum($(`#HistoryTotalTaxes${i}`).text().trim());
  const advTaxes = toNum($(`#HistoryTotalAdvTaxes${i}`).text().trim());
  const nadvTaxes = toNum($(`#HistoryTotalNAdvTaxes${i}`).text().trim());
  console.log(`HistoryTotalTaxes${i}: ${totalTaxes}, HistoryTotalAdvTaxes${i}: ${advTaxes}, HistoryTotalNAdvTaxes${i}: ${nadvTaxes}`);
}

console.log('\nComplex selectors:');
const sel1 = $('div:nth-child(1) > table.clsWide:nth-child(3) > tbody > tr > td.clsFieldR:nth-child(1)').first().text().trim();
const sel2 = $('td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)').text().trim();
const sel3 = $('div:nth-child(1) > table.clsWide:nth-child(1) > tbody > tr:nth-child(6) > td.clsField:nth-child(1)').text().trim();
console.log('Selector 1:', sel1);
console.log('Selector 2:', sel2);
console.log('Selector 3:', sel3);
