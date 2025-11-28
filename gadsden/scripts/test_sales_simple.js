const fs = require('fs');
const html = fs.readFileSync('input.html', 'utf-8');
const matches = html.match(/sprGrantee_lblSuppressed[^>]*>([^<]+)<\/span>/g);
console.log('Grantee matches found:', matches ? matches.length : 0);
if (matches) {
  matches.forEach((m, i) => {
    const name = m.replace(/.*>([^<]+)<\/span>/, '$1');
    console.log(`Grantee ${i+1}: "${name}"`);
  });
}
