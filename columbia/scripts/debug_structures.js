const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('input.html', 'utf8');
const $ = cheerio.load(html);

const FEATURE_PATTERNS = {
  utility: [
    /UTILITY/i, /WELL/i, /SEPTIC/i, /IRRIGATION/i, /SPRINK/i, /PUMP/i,
    /POWER/i, /ELECTRIC/i, /TRANSFORMER/i, /GENERATOR/i, /WATER/i, /GAS/i
  ],
  layout: [
    /PAV(E)?M(EN)?T/i, /PAVERS?/i, /PATIO/i, /DRIVE/i, /DRIVEWAY/i,
    /SIDEWALK/i, /SIDE WALK/i, /SLAB/i, /COURT/i, /TRACK/i, /CONC(RETE)?/i,
    /ASPHALT/i, /PARKING/i, /APR(o)?N/i, /BIN/i
  ],
  structure: [
    /BUILDING/i, /BARN/i, /GARAGE/i, /CARPORT/i, /CANOPY/i, /SHED/i,
    /STORAGE/i, /PAVILION/i, /CABIN/i, /GREENHOUSE/i, /DOCK/i, /POOL/i,
    /FENCE/i, /HOUSE/i, /STABLE/i, /LEAN/i
  ]
};

function classifyFeature(description) {
  const desc = description || '';
  if (!desc) return 'structure';
  const isMatch = (patterns) => patterns.some((re) => re.test(desc));
  if (isMatch(FEATURE_PATTERNS.utility)) return 'utility';
  if (isMatch(FEATURE_PATTERNS.layout)) return 'layout';
  if (isMatch(FEATURE_PATTERNS.structure)) return 'structure';
  return 'structure';
}

const table = $('#parcelDetails_XFOBTable table.parcelDetails_insideTable').first();
const features = [];
table.find('tr').each((idx, row) => {
  const tds = $(row).find('td');
  if (tds.length >= 6) {
    const codeCell = $(tds[0]).text().trim();
    const description = $(tds[1]).text().trim();
    if (!/^code$/i.test(codeCell) && description) {
      const category = classifyFeature(description);
      features.push({ description, category });
    }
  }
});

console.log('All features with categories:');
features.forEach((f, i) => {
  console.log(`${i+1}: [${f.category}] ${f.description}`);
});

console.log('\nStructure features only:');
const structureFeatures = features.filter(f => f.category === 'structure');
console.log('Count:', structureFeatures.length);
structureFeatures.forEach((f, i) => {
  console.log(`${i+1}: ${f.description}`);
});
