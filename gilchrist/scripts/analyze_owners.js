const data = require('./owners/owner_data.json');
const key = Object.keys(data).find(k => k.startsWith('property_'));
const owners = data[key].owners_by_date;

const personSet = new Set();
const companySet = new Set();

Object.entries(owners).filter(([k]) => !k.startsWith('unknown_date')).forEach(([dateKey, arr]) => {
  arr.forEach(o => {
    if (o.type === 'person') {
      const key = `${o.first_name}|${o.last_name}`.toUpperCase();
      personSet.add(key);
    } else if (o.type === 'company') {
      companySet.add(o.name.toUpperCase());
    }
  });
});

console.log('Unique persons (excluding unknown_date):', personSet.size);
console.log('Unique companies (excluding unknown_date):', companySet.size);
console.log('\nPerson keys:');
Array.from(personSet).forEach((p, i) => console.log(`  ${i+1}. ${p}`));
