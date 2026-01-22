const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

function toNumberCurrency(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned.toUpperCase() === "N/A") return null;
  const num = Number(cleaned);
  if (Number.isNaN(num)) return null;
  return num;
}

const hmstd = toNumberCurrency($('#HmstdExemptAmount').first().text());
const nonSchool = toNumberCurrency($('#NonSchoolAddHmstdExemptAmount').first().text());

console.log('HmstdExemptAmount:', hmstd);
console.log('NonSchoolAddHmstdExemptAmount:', nonSchool);
console.log('Total:', (hmstd || 0) + (nonSchool || 0));
