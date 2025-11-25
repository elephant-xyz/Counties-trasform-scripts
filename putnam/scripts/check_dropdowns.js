const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

// Get property address
const addr = $('.summary-card .row').filter((i, el) => $(el).text().includes('911 address')).find('.col-8').text().trim();
const mailing = $('.summary-card .row').filter((i, el) => $(el).text().includes('Mailing')).find('.col-8').text().trim();

console.log('Property 911 Address:', addr);
console.log('Mailing Address:', mailing);
console.log('');

// Check if property data matches any dropdown values
const opts = [];
$('option[data-tokens]').each((i, el) => {
  const val = $(el).attr('data-tokens');
  if (val && val !== 'Any') opts.push(val);
});

console.log('Total dropdown options:', opts.length);
console.log('First 10 options:', opts.slice(0, 10).join(', '));
console.log('');

// Check for matches
console.log('Checking if any dropdown values are relevant to THIS property...');
let foundMatch = false;
opts.forEach(opt => {
  if (addr.toUpperCase().includes(opt.toUpperCase()) || mailing.toUpperCase().includes(opt.toUpperCase())) {
    console.log('  ✓ MATCH found:', opt);
    foundMatch = true;
  }
});

if (!foundMatch) {
  console.log('  ✗ NO MATCHES - dropdown options are generic search UI, not THIS property\'s data');
}

console.log('\nConclusion: Dropdown options are search form UI elements, not property-specific data to extract.');
