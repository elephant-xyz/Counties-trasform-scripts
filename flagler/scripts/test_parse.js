const fs = require('fs');
const cheerio = require('cheerio');

const parseIntSafe = (str) => {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9]/g, "");
  if (!n) return null;
  return parseInt(n, 10);
};

const moneyToNumber = (str) => {
  if (str == null) return null;
  const n = String(str).replace(/[^0-9.\-]/g, "");
  if (n === "" || n === ".") return null;
  const v = Number(n);
  return isNaN(v) ? null : v;
};

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

const index = 0;
const year = years[index];
const getValues = (labels) => {
  const keys = Array.isArray(labels) ? labels : [labels];
  for (const key of keys) {
    const normalized = String(key).trim().toLowerCase();
    if (rowMap.has(normalized)) {
      const values = rowMap.get(normalized);
      if (Array.isArray(values) && values.length > index) {
        return values[index];
      }
    }
  }
  return null;
};

const work = {
  year,
  improvement: moneyToNumber(getValues(["building value", "improvement value"])) || null,
  extraFeatures: moneyToNumber(getValues("extra features value")) || null,
  land: moneyToNumber(getValues("land value")) || null,
};

console.log('work object:', work);

const buildingTotal = (work.improvement || 0) + (work.extraFeatures || 0);
console.log('buildingTotal:', buildingTotal);
console.log('property_building_amount:', buildingTotal > 0 ? buildingTotal : work.improvement || null);
