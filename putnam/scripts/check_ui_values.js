const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

console.log("=== Checking if UI elements contain current property data ===\n");

// Check zip code - is it for this property?
console.log("1. Zip code 32131:");
const site_address = $('.summary-card .row').filter((i, el) => {
  return $(el).text().includes('911 address');
}).find('.col-8').text().trim();
console.log("   Property 911 address:", site_address);
console.log("   Contains 32131?", site_address.includes('32131'));

// Check city names
console.log("\n2. City in address:");
const mailing = $('.summary-card .row').filter((i, el) => {
  return $(el).text().includes('Mailing address');
}).find('.col-8').text().trim();
console.log("   Mailing address:", mailing);

// Check if #tab-Address contains useful data
console.log("\n3. #tab-Address element:");
console.log("   Text:", $('#tab-Address').text().trim());
console.log("   Is this just a tab label? YES");

// Check card-body table
console.log("\n4. div.card-body table cells:");
$('.card-body table tbody tr').slice(0, 3).each((i, row) => {
  const cells = $(row).find('td').map((j, td) => $(td).text().trim()).get();
  console.log("   Row:", cells.join(' | '));
});

console.log("\n=== CONCLUSION ===");
console.log("- Dropdown options are search UI, not property data");
console.log("- Tab labels are navigation UI, not property data");  
console.log("- Table cells in card-body and table-wrapper ARE property data");
console.log("- Only extract table data, ignore UI elements");
