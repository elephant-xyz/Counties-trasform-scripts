const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);
const CURRENT_OWNER_SELECTOR = '[id*="lstPrimaryOwner"][id*="lblPrimaryOwnerName"][id$="lblSearch"]';
const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
const owners = [];
$(CURRENT_OWNER_SELECTOR).each((i, el) => {
  console.log(`Element ${i}:`, $(el).attr('id'));
  console.log(`  Text:`, $(el).text());
  const owner_text_split = $(el).text().split('\n');
  console.log(`  Split by newline:`, owner_text_split);
  for (const owner of owner_text_split) {
    if (owner.trim()) {
      const t = txt(owner.trim());
      console.log(`  Extracted:`, t);
      owners.push(t);
      break;
    }
  }
});
console.log('Final owners:', JSON.stringify(owners, null, 2));
