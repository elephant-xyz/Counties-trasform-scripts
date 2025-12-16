const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const html = fs.readFileSync(path.join(__dirname, '../input/1907S04W4250000C0120.html'), 'utf8');
const $ = cheerio.load(html);
console.log('SALES GRANTEES:');
$('section.sale table.grid2 tbody tr').each((i, tr) => {
  const tds = $(tr).find('td');
  const ownershipCell = tds.eq(7);
  const dateCell = tds.eq(1);
  const instCell = tds.eq(0);
  if (dateCell.text().trim()) {
    const html = ownershipCell.html();
    const granteeMatch = html?.match(/<span>Grantee:<\/span>\s*([^<]+)/);
    const granteeName = granteeMatch ? granteeMatch[1].trim() : null;
    console.log(`Row ${i}: Date=${dateCell.text().trim()}, Grantee=${granteeName}`);
  }
});
