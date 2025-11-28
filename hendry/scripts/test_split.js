const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();

function splitCompositeNames(name) {
  const cleaned = txt(name);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s*&\s*|\s+and\s+|\s*\/\s*|\s*;\s*|\s*\+\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts;
}

const name = 'DARRAGH DENNIS S & YVONNE T';
const parts = splitCompositeNames(name);
console.log('Split parts:', parts);
parts.forEach((part, i) => {
  console.log(`Part ${i}: "${part}"`);
});
