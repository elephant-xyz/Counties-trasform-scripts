const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "input", "22430011621.html"), "utf8");
const $ = cheerio.load(html);

function toNum(str) {
  const cleaned = String(str).replace(/[$,\s]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

let total = 0;
for (let i = 1; i <= 12; i++) {
  const val = $(`#Tax${i}`).text().trim();
  const num = toNum(val);
  if (val) {
    console.log(`Tax${i}: ${val} = ${num}`);
    total += num;
  }
}
console.log('\nTotal of Tax1-12:', total);
console.log('TotalAdvTaxes:', $('#TotalAdvTaxes').first().text().trim(), '=', toNum($('#TotalAdvTaxes').first().text().trim()));
console.log('TotalNAdvTaxes:', $('#TotalNAdvTaxes').first().text().trim(), '=', toNum($('#TotalNAdvTaxes').first().text().trim()));
console.log('TotalTaxes:', $('#TotalTaxes').first().text().trim(), '=', toNum($('#TotalTaxes').first().text().trim()));
console.log('\nTAX1 (non-ad valorem):', $('#TAX1').text().trim(), '=', toNum($('#TAX1').text().trim()));
console.log('TAX2 (non-ad valorem):', $('#TAX2').text().trim(), '=', toNum($('#TAX2').text().trim()));
