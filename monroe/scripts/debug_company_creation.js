const fs = require('fs');
const path = require('path');

// Check if company was created
const companyPath = './data/company_1.json';
if (fs.existsSync(companyPath)) {
  const company = JSON.parse(fs.readFileSync(companyPath, 'utf-8'));
  console.log('Company 1 exists:', JSON.stringify(company, null, 2));
}

// Check for sales_history files
const dataFiles = fs.readdirSync('./data');
const salesFiles = dataFiles.filter(f => f.startsWith('sales_history_'));
console.log('Sales history files:', salesFiles);

// Check for relationship files involving company
const relationshipFiles = dataFiles.filter(f => f.includes('company'));
console.log('Relationship files involving company:', relationshipFiles);

// Check if owners data exists
const ownersPath = './owners/owner_data.json';
if (fs.existsSync(ownersPath)) {
  console.log('owners/owner_data.json exists');
} else {
  console.log('owners/owner_data.json does NOT exist');
}
