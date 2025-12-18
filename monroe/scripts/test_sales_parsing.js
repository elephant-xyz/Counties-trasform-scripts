const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

// Check for Sales section
let found = false;
$("section").each((_, section) => {
  const title = $(section).find("div.title, .title").first().text().trim().toLowerCase();
  if (title === "sales") {
    found = true;
    console.log('Found Sales section!');
    const table = $(section).find("table").first();
    if (table && table.length) {
      console.log('Found Sales table');
      const rows = table.find("tbody tr");
      console.log('Number of rows:', rows.length);

      rows.each((i, tr) => {
        const trEl = $(tr);
        const header = trEl.find("th").first();
        const tds = trEl.find("td");
        const date = header.text().trim();
        if (tds.length >= 9) {
          const grantee = tds.eq(8).text().trim();
          console.log('Row', i, ': Date=', date, ', Grantee=', grantee);
        }
      });
    }
  }
});

if (!found) {
  console.log('Sales section not found');
}
