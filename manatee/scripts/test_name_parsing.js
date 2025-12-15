function norm(str) { return String(str || '').replace(/\s+/g, ' ').trim(); }
function normalizeWhitespace(str) { return (str || '').replace(/\s+/g, ' ').replace(/[\u00A0\s]+/g, ' ').trim(); }
function cleanInvalidCharsFromName(raw) {
  let parsedName = normalizeWhitespace(raw)
    .replace(/\([^)]*\)/g, '')
    .replace(/\*/g, '')
    .replace(/\bLE\b/g, '')
    .replace(/\bAS\s+SUCC\b/gi, '')
    .replace(/[^A-Za-z\-' .]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  while (/^[\-' .]/i.test(parsedName)) { parsedName = parsedName.slice(1); }
  while (/[\-' .]$/i.test(parsedName)) { parsedName = parsedName.slice(0, parsedName.length - 1); }
  return parsedName;
}
function titleCaseName(s) {
  if (!s) return null;
  s = s.trim().replace(/^[\s\-',.]+|[\s\-',.]+$/g, '');
  if (!s) return null;
  const normalized = s.toLowerCase().replace(/[\s\-',.]+/g, (match) => {
    if (match.length > 1 || match === ',') { return ' '; }
    return match;
  });
  const result = normalized.replace(/(^|[\s\-'.])([a-z])/g, (match, delimiter, letter) => {
    return delimiter + letter.toUpperCase();
  });
  const namePattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
  if (!result || !namePattern.test(result)) { return null; }
  return result;
}

const testNames = [
  'KAYE, EUGENE G *',
  'ZIMMERLEE, EVERETT *',
  'LASLEY, MARY C',
  'FUST, HELEN M'
];

testNames.forEach(input => {
  console.log('\n=== Testing:', input, '===');
  const segs = input.split(',').map(s => norm(s)).filter(Boolean);
  console.log('Segments:', segs);
  const last = cleanInvalidCharsFromName(segs[0]);
  console.log('Last name cleaned:', JSON.stringify(last));
  const rest = segs.slice(1).join(' ');
  console.log('Rest:', JSON.stringify(rest));
  const tokens = rest.split(/\s+/).filter(Boolean);
  console.log('Tokens:', tokens);
  const first = cleanInvalidCharsFromName(tokens.shift()) || '';
  console.log('First name cleaned:', JSON.stringify(first));
  const middle = cleanInvalidCharsFromName(tokens.join(' ')) || null;
  console.log('Middle name cleaned:', JSON.stringify(middle));
  console.log('First titlecased:', titleCaseName(first));
  console.log('Middle titlecased:', titleCaseName(middle));
  console.log('Last titlecased:', titleCaseName(last));
});
