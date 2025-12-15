const pattern = /^[A-Z][a-z]*([ \-',.][A-Za-z][a-z]*)*$/;
console.log('W matches:', pattern.test('W'));
console.log('C matches:', pattern.test('C'));
console.log('Dawkins matches:', pattern.test('Dawkins'));
console.log('Jr. matches:', pattern.test('Jr.'));
