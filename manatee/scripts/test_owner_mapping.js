const ownerMapping = require('./scripts/transform/manatee/ownerMapping.js');
const fs = require('fs');
const path = require('path');

// Read input
const input = JSON.parse(fs.readFileSync('./input/7760004106.json', 'utf8'));

// Run owner mapping
const result = ownerMapping(input);

// Write output
fs.mkdirSync('./owners', {recursive: true});
fs.writeFileSync('./owners/owner_data.json', JSON.stringify(result, null, 2));

console.log('Owner data generated:', JSON.stringify(result, null, 2));
