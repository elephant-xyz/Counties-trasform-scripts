const fs = require('fs');
const ownerData = JSON.parse(fs.readFileSync('owners/owner_data.json', 'utf8'));
const prop = ownerData['property_00424726148504010'];

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const persons = [];
const personKeys = new Set();
const currentOwners = [];

// Current owners
const current = prop.owners_by_date['current'] || [];
current.forEach(o => {
  if (o.type === 'person') {
    const first = toTitleCase(o.first_name);
    const middle = o.middle_name ? toTitleCase(o.middle_name) : null;
    const last = toTitleCase(o.last_name);
    const key = `${first}|${middle || ''}|${last}`;
    if (!personKeys.has(key)) {
      persons.push({first, middle, last, key});
      currentOwners.push(persons.length);
      personKeys.add(key);
    }
  }
});

// Historical
Object.entries(prop.owners_by_date).forEach(([dt, owners]) => {
  if (dt === 'current') return;
  owners.forEach(o => {
    if (o.type === 'person') {
      const first = toTitleCase(o.first_name);
      const middle = o.middle_name ? toTitleCase(o.middle_name) : null;
      const last = toTitleCase(o.last_name);
      const key = `${first}|${middle || ''}|${last}`;
      if (!personKeys.has(key)) {
        persons.push({first, middle, last, key});
        personKeys.add(key);
      }
    }
  });
});

console.log('Total persons:', persons.length);
console.log('Current owner indices:', currentOwners);
persons.forEach((p, i) => {
  console.log(`person_${i+1}:`, JSON.stringify(p));
});
