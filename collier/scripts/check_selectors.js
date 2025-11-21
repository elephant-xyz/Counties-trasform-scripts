const cheerio = require('cheerio');
const fs = require('fs');

const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'input', '16059920002.html'), 'utf8');
const $ = cheerio.load(html);

const selector1 = 'td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(50) > td.clsFieldR:nth-child(5)';
const selector2 = 'td.clsNoBorderBox:nth-child(3) > table.clsWide > tbody > tr:nth-child(14) > td.clsFields:nth-child(1)';

console.log('Selector 1:', $(selector1).text().trim());
console.log('Selector 2:', $(selector2).text().trim());

// Check if they have IDs
const elem1 = $(selector1);
const elem2 = $(selector2);
console.log('Selector 1 ID:', elem1.attr('id'));
console.log('Selector 2 ID:', elem2.attr('id'));
