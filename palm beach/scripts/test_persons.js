const path = require('path');
const fs = require('fs');
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}
const ownerJSON = readJSON('owners/owner_data.json');
const parcelId = '00424414130060030';

function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildPersonsAndCompanies(ownerJSON, parcelId) {
  const res = {
    persons: [],
    companies: [],
    personIndexByKey: new Map(),
    companyIndexByName: new Map(),
    personCurrentOwners: [],
    companyCurrentOwners: []
  };
  if (!ownerJSON) return res;
  const key = `property_${parcelId}`;
  const obj = ownerJSON[key];
  if (!obj || !obj.owners_by_date) return res;

  // Current owners first
  const current = obj.owners_by_date['current'] || [];
  current.forEach((o) => {
    if (o.type === 'person') {
      const firstName = toTitleCase(o.first_name);
      const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
      const lastName = toTitleCase(o.last_name);
      const personKey = `${firstName}|${middleName || ''}|${lastName}`;
      console.log('Current person key:', personKey);
      if (!res.personIndexByKey.has(personKey)) {
        res.persons.push({
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
        });
        res.personCurrentOwners.push(res.persons.length);
        res.personIndexByKey.set(personKey, res.persons.length);
        console.log('  Added as person_' + res.persons.length);
      } else {
        console.log('  Already exists as person_' + res.personIndexByKey.get(personKey));
      }
    }
  });

  // Historical owners
  Object.entries(obj.owners_by_date).forEach(([dt, owners]) => {
    if (dt === 'current') return;
    (owners || []).forEach((o) => {
      if (o.type === 'person') {
        const firstName = toTitleCase(o.first_name);
        const middleName = o.middle_name ? toTitleCase(o.middle_name) : null;
        const lastName = toTitleCase(o.last_name);
        const personKey = `${firstName}|${middleName || ''}|${lastName}`;
        console.log('Historical person key:', personKey, 'date:', dt);
        if (!res.personIndexByKey.has(personKey)) {
          res.persons.push({
            first_name: firstName,
            last_name: lastName,
            middle_name: middleName,
          });
          res.personIndexByKey.set(personKey, res.persons.length);
          console.log('  Added as person_' + res.persons.length);
        } else {
          console.log('  Already exists as person_' + res.personIndexByKey.get(personKey));
        }
      }
    });
  });

  return res;
}

const pc = buildPersonsAndCompanies(ownerJSON, parcelId);
console.log('\nTotal persons:', pc.persons.length);
console.log('\nCurrent owner indices:', pc.personCurrentOwners);
console.log('\nAll persons:');
pc.persons.forEach((p, i) => {
  console.log(`  person_${i+1}:`, JSON.stringify(p));
});
