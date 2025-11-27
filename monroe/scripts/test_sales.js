const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);

// Search for Sales section
$("section").each((_, section) => {
  const title = $(section).find("div.title").first().text().trim().toLowerCase();
  if (title === "sales") {
    console.log('Found Sales section!');
    const table = $(section).find("table").first();
    if (table && table.length) {
      console.log('Found Sales table');
      const rows = table.find("tbody tr");
      console.log('Number of rows:', rows.length);
      
      rows.each((i, tr) => {
        const $tr = $(tr);
        const tds = $tr.find("td");
        const header = $tr.find("th").first();
        const date = header.text().trim();
        
        if (tds && tds.length >= 9) {
          const grantee = tds.eq(8).text().trim();
          console.log(`Sale ${i+1}: Date=${date}, Grantee=${grantee}`);
        }
      });
    }
  }
});
