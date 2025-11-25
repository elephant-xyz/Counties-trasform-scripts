const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

// Check some error selectors
console.log("=== Checking selector 1: tr.text-nowrap:nth-child(2) > td.text-center:nth-child(13) ===");
const val1 = $('.table-wrapper table tbody tr.text-nowrap:nth-child(2) td.text-center:nth-child(13)').text().trim();
console.log("Value:", val1);

console.log("\n=== Checking selector 2: option[data-tokens='32131'] ===");
const val2 = $('option[data-tokens="32131"]').first().text().trim();
console.log("Value:", val2);

console.log("\n=== Checking selector 3: #tab-Address ===");
const val3 = $('#tab-Address').text().trim();
console.log("Value:", val3);

console.log("\n=== All text-nowrap rows ===");
$('.table-wrapper table tbody tr.text-nowrap').each((i, el) => {
  const td1 = $(el).find('td').eq(0).text().trim();
  console.log(`Row ${i+1}: ${td1}`);
});
