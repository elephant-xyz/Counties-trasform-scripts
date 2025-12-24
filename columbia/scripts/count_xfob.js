const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);
const table = $('#parcelDetails_XFOBTable table.parcelDetails_insideTable').first();
let count = 0;
const features = [];
table.find('tr').each((idx, row) => {
  const tds = $(row).find('td');
  if (tds.length >= 6) {
    const codeCell = $(tds[0]).text().trim();
    if (!/^code$/i.test(codeCell) && codeCell) {
      count++;
      const desc = $(tds[1]).text().trim();
      features.push(desc);
      console.log(count + ': ' + desc);
    }
  }
});
console.log('\nTotal XFOB features:', count);
console.log('\nStructure features:');
const structurePattern = [
  /BUILDING/i, /BARN/i, /GARAGE/i, /CARPORT/i, /CANOPY/i, /SHED/i,
  /STORAGE/i, /PAVILION/i, /CABIN/i, /GREENHOUSE/i, /DOCK/i, /POOL/i,
  /FENCE/i, /HOUSE/i, /STABLE/i, /LEAN/i
];
const structureFeatures = features.filter(desc =>
  structurePattern.some(re => re.test(desc))
);
console.log('Structure count:', structureFeatures.length);
structureFeatures.forEach((f, i) => console.log((i+1) + ': ' + f));
