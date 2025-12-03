const fs = require('fs');
const cheerio = require('cheerio');

function parseIntSafe(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9]/g, "");
  if (!n) return null;
  return parseInt(n, 10);
}

function moneyToNumber(str) {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "" || n === ".") return null;
  const v = Number(n);
  return isNaN(v) ? null : v;
}

const html = fs.readFileSync('07-11-31-7011-00030-0180.html', 'utf8');
const $ = cheerio.load(html);
const table = $("table[id*='grdValuation']").first();

const years = [];
table.find("thead th.value-column").each((i, th) => {
  const raw = $(th).text();
  const match = raw.match(/(\d{4})/);
  if (!match) return;
  const year = parseIntSafe(match[1]);
  if (year) years.push(year);
});

const rowMap = new Map();
table.find("tbody tr").each((i, tr) => {
  const label = $(tr).find("th").first().text().trim();
  if (!label) return;
  const values = [];
  $(tr).find("td.value-column").each((_, td) => values.push($(td).text().trim()));
  rowMap.set(label.trim().toLowerCase(), values);
});

console.log('Years:', years);

const index = 0;
const getValues = (labels) => {
  const keys = Array.isArray(labels) ? labels : [labels];
  for (const key of keys) {
    const normalized = String(key).trim().toLowerCase();
    if (rowMap.has(normalized)) {
      const values = rowMap.get(normalized);
      if (Array.isArray(values) && values.length > index) {
        console.log(`Found key "${normalized}": ${values[index]}`);
        return values[index];
      }
    }
  }
  console.log(`Key not found:`, keys);
  return null;
};

const improvement = getValues(["building value", "improvement value"]);
const extraFeatures = getValues("extra features value");

console.log('\nRaw values:');
console.log('  improvement:', improvement);
console.log('  extraFeatures:', extraFeatures);

console.log('\nConverted:');
console.log('  improvement:', moneyToNumber(improvement));
console.log('  extraFeatures:', moneyToNumber(extraFeatures));
console.log('  total:', moneyToNumber(improvement) + moneyToNumber(extraFeatures));
