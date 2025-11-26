const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);
$('span[id*="sprOwnerName"][id*="lnkUpmSearchLinkSuppressed_lblSearch"]').each((i, el) => {
  console.log('Owner', i + ':', $(el).text());
});
