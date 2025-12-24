const data = require('./owners/owner_data.json');
const key = Object.keys(data).find(k => k.startsWith('property_'));
const owners = data[key].owners_by_date;

const personSet = new Set();
const personSetWithUnknown = new Set();

Object.entries(owners).forEach(([dateKey, arr]) => {
  arr.forEach(o => {
    if (o.type === 'person') {
      const k = `${(o.first_name || '').trim().toUpperCase()}|${(o.last_name || '').trim().toUpperCase()}`;
      personSetWithUnknown.add(k);
      if (!dateKey.startsWith('unknown_date')) {
        personSet.add(k);
      }
    }
  });
});

console.log('Unique persons (excluding unknown_date):', personSet.size);
console.log('Unique persons (including unknown_date):', personSetWithUnknown.size);
console.log('Persons in unknown_date only:', personSetWithUnknown.size - personSet.size);

console.log('\nAll persons (excluding unknown_date):');
Array.from(personSet).sort().forEach((p, i) => console.log(`  ${i+1}. ${p}`));

console.log('\nPersons ONLY in unknown_date:');
const unknownOnlyPersons = Array.from(personSetWithUnknown).filter(p => !personSet.has(p));
unknownOnlyPersons.sort().forEach((p, i) => console.log(`  ${i+1}. ${p}`));
