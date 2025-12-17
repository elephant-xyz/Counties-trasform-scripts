const fs = require('fs');
const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;

// Check all sales_history relationship files
const relFiles = fs.readdirSync('data').filter(f => f.match(/relationship_sales_history_\d+_has_person/));
relFiles.sort().forEach(relFile => {
  const rel = JSON.parse(fs.readFileSync('data/' + relFile, 'utf-8'));
  const personFile = rel.to['/'].replace('./', '');
  const person = JSON.parse(fs.readFileSync('data/' + personFile, 'utf-8'));
  
  const firstValid = pattern.test(person.first_name);
  const lastValid = pattern.test(person.last_name);
  const middleValid = !person.middle_name || pattern.test(person.middle_name);
  
  const allValid = firstValid && lastValid && middleValid;
  const status = allValid ? '✓ VALID' : '✗ INVALID';
  
  console.log(`${relFile} -> ${personFile} ${status}`);
  if (!allValid) {
    console.log(`  first_name: '${person.first_name}' - ${firstValid ? 'OK' : 'FAIL'}`);
    console.log(`  last_name: '${person.last_name}' - ${lastValid ? 'OK' : 'FAIL'}`);
    if (person.middle_name) {
      console.log(`  middle_name: '${person.middle_name}' - ${middleValid ? 'OK' : 'FAIL'}`);
    }
  }
});
