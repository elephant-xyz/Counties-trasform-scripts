const fs = require('fs');
const path = require('path');

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function parseDateToISO(s) {
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = m[1].padStart(2, '0');
    const day = m[2].padStart(2, '0');
    return `${m[3]}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

const parcelId = '34-3N-B0-MINR0-004-0010';
const owners = readJSON(path.join('owners', 'owner_data.json'));
const key = `property_${parcelId}`;
const record = owners[key];
const ownersByDate = record.owners_by_date;

const sales = [
  { saleDate: '08/11/2020' },
  { saleDate: '12/01/2019' }
];

// Find latest sale
let latestSaleISO = null;
let latestSaleIdx = null;
sales.forEach((rec, idx) => {
  const iso = parseDateToISO(rec.saleDate);
  if (!iso) return;
  if (!latestSaleISO || iso > latestSaleISO) {
    latestSaleISO = iso;
    latestSaleIdx = idx + 1;
  }
});

console.log(`Latest sale: ${latestSaleISO} (index ${latestSaleIdx})`);

// First pass: collect companies
const salesDates = new Set();
sales.forEach((rec) => {
  const d = parseDateToISO(rec.saleDate);
  if (d) salesDates.add(d);
});

console.log('Sales dates:', Array.from(salesDates));

// Check if current owners should be used
let useCurrentOwners = false;
if (latestSaleISO && ownersByDate["current"]) {
  const latestSaleOwners = ownersByDate[latestSaleISO] || [];
  console.log(`Owners on latest sale date (${latestSaleISO}):`, latestSaleOwners);
  if (latestSaleOwners.length === 0) {
    useCurrentOwners = true;
    salesDates.add("current");
    console.log("No owners on latest sale date, using current owners");
  } else {
    console.log("Owners exist on latest sale date, not using current owners as separate");
  }
}

const companyMap = new Map();

Object.keys(ownersByDate).forEach((dateKey) => {
  if (/^unknown_date_\d+$/.test(dateKey)) {
    console.log(`Skipping ${dateKey}`);
    return;
  }
  
  const matchesSaleDate = salesDates.has(dateKey);
  console.log(`Date ${dateKey}: matches sale? ${matchesSaleDate}`);
  
  if (!matchesSaleDate) return;
  
  const ownersOnDate = ownersByDate[dateKey] || [];
  ownersOnDate.forEach((o) => {
    if (o.type === 'company' && (o.name || '').trim()) {
      const normalizedName = (o.name || '').trim().toUpperCase();
      if (!companyMap.has(normalizedName)) {
        console.log(`  Adding company: '${o.name}' (normalized: '${normalizedName}')`);
        companyMap.set(normalizedName, (o.name || '').trim());
      } else {
        console.log(`  Company already exists: '${o.name}'`);
      }
    }
  });
});

const companies = Array.from(companyMap.values()).map((n) => ({name: n}));
console.log(`\nTotal companies in array: ${companies.length}`);
companies.forEach((c, idx) => console.log(`  company_${idx+1}: ${c.name}`));
