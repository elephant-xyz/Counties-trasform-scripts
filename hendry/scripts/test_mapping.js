const deedCodeMap = {
  TRUST: "Trustee's Deed",
  TR: "Trustee's Deed"
};

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const key = instr.trim().toUpperCase();
  return deedCodeMap[key] || null;
}

console.log('Trust ->', mapInstrumentToDeedType('Trust'));
console.log('TRUST ->', mapInstrumentToDeedType('TRUST'));
console.log('TR ->', mapInstrumentToDeedType('TR'));
console.log('tr ->', mapInstrumentToDeedType('tr'));
console.log('xyz ->', mapInstrumentToDeedType('xyz'));
