const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('../input/57373120000.html', 'utf8');
const $ = cheerio.load(html);

console.log('permittype1:', $('#permittype1').text().trim());
console.log('permitno1:', $('#permitno1').text().trim());
console.log('IssuedDate1:', $('#IssuedDate1').text().trim());
console.log('codate1:', $('#codate1').text().trim());
console.log('taxyear1:', $('#taxyear1').text().trim());

// Check a few more
for (let i = 1; i <= 5; i++) {
  const ptype = $(`#permittype${i}`).text().trim();
  const pno = $(`#permitno${i}`).text().trim();
  if (ptype || pno) {
    console.log(`Permit ${i}: type="${ptype}", no="${pno}"`);
  }
}
