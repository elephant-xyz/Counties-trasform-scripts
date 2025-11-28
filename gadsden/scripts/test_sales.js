const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

function textOf($, el) {
  return $(el).text().trim();
}

// Find the sales table
let salesTable = null;
$('section').each((_, section) => {
  if (salesTable) return;
  const title = $(section).find('div.title').first().text().trim().toLowerCase();
  if (title === 'sales') {
    const candidate = $(section).find('table').first();
    if (candidate && candidate.length) {
      salesTable = candidate;
    }
  }
});

if (!salesTable || !salesTable.length) {
  console.log('No sales table found');
} else {
  console.log('Sales table found');
  const rows = salesTable.find('tbody tr');
  console.log(\`Number of sales rows: \${rows.length}\`);
  
  rows.each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find('td');
    const header = $tr.find('th').first();
    const date = textOf($, header);
    if (tds && tds.length >= 9) {
      const grantee = textOf($, tds.eq(8));
      console.log(\`Row \${i}: date=\${date}, grantee="\${grantee}"\`);
    }
  });
}
