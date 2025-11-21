const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

// Find HTML file in input directory
const inputDir = path.join(__dirname, '..', 'input');
const htmlFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.html'));
const htmlFile = htmlFiles[0] || '16059920002.html';

const html = fs.readFileSync(path.join(inputDir, htmlFile), 'utf8');
const $ = cheerio.load(html);

console.log('taxyear38:', $('#taxyear38').text().trim());
console.log('permitno38:', $('#permitno38').text().trim());
console.log('permittype38:', $('#permittype38').text().trim());
console.log('TaName8:', $('#TaName8').text().trim());
console.log('Tax8:', $('#Tax8').text().trim());
console.log('YRBUILT1:', $('#YRBUILT1').text().trim());
console.log('OwnerLine3:', $('#OwnerLine3').text().trim());
console.log('OwnerCity:', $('#OwnerCity').text().trim());

// Check if PermitAdditional table exists
const permitRows = $('#PermitAdditional tr');
console.log('\nPermit rows found:', permitRows.length);
