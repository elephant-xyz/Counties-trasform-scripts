const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf-8');
const $ = cheerio.load(html);
const CURRENT_OWNER_SELECTOR = '#ctlBodyPane_ctl09_ctl01_lstPrimaryOwner_ctl00_lblPrimaryOwnerName_lnkUpmSearchLinkSuppressed_lblSearch';
const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();
const owners = [];
$(CURRENT_OWNER_SELECTOR).each((i, el) => {
  const owner_text_split = $(el).text().split('\n');
  for (const owner of owner_text_split) {
    if (owner.trim()) {
      const t = txt(owner.trim());
      owners.push(t);
      break;
    }
  }
});
console.log('Current owners extracted:', JSON.stringify(owners, null, 2));

// Now let's check ALL current owner elements
const ALL_CURRENT_OWNER_SELECTOR = '[id*="lstPrimaryOwner"][id*="lblPrimaryOwnerName"]';
const allOwners = [];
$(ALL_CURRENT_OWNER_SELECTOR).each((i, el) => {
  const t = txt($(el).text());
  if (t) allOwners.push(t);
});
console.log('All current owners (all elements):', JSON.stringify(allOwners, null, 2));
