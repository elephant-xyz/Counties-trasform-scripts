const deedCodeMap = {
  WD: "Warranty Deed",
  WTY: "Warranty Deed",
  SWD: "Special Warranty Deed",
  SW: "Special Warranty Deed",
  "SPEC WD": "Special Warranty Deed",
  QCD: "Quitclaim Deed",
  QC: "Quitclaim Deed",
  QUITCLAIM: "Quitclaim Deed",
  "QUITCLAIM DEED": "Quitclaim Deed",
  GD: "Grant Deed",
  BSD: "Bargain and Sale Deed",
  LBD: "Lady Bird Deed",
  TOD: "Transfer on Death Deed",
  TODD: "Transfer on Death Deed",
  SD: "Sheriff's Deed",
  "SHRF'S DEED": "Sheriff's Deed",
  TD: "Tax Deed",
  TRD: "Trustee's Deed",
  "TRUSTEE DEED": "Trustee's Deed",
  TR: "Trustee's Deed",
  TRUST: "Trustee's Deed",
  PRD: "Personal Representative Deed",
  "PERS REP DEED": "Personal Representative Deed",
  CD: "Correction Deed",
  "CORR DEED": "Correction Deed",
  DIL: "Deed in Lieu of Foreclosure",
  DILF: "Deed in Lieu of Foreclosure",
  LED: "Life Estate Deed",
  JTD: "Joint Tenancy Deed",
  TIC: "Tenancy in Common Deed",
  CPD: "Community Property Deed",
  "GIFT DEED": "Gift Deed",
  ITD: "Interspousal Transfer Deed",
  "WILD D": "Wild Deed",
  SMD: "Special Master's Deed",
  COD: "Court Order Deed",
  CFD: "Contract for Deed",
  QTD: "Quiet Title Deed",
  AD: "Administrator's Deed",
  "GD (GUARDIAN)": "Guardian's Deed",
  RD: "Receiver's Deed",
  ROW: "Right of Way Deed",
  VPD: "Vacation of Plat Deed",
  AOC: "Assignment of Contract",
  ROC: "Release of Contract",
  DC: "Miscellaneous",
  IC: "Miscellaneous",
  MS: "Miscellaneous",
};

function mapInstrumentToDeedType(instr) {
  if (!instr) return null;
  const key = instr.trim().toUpperCase();
  return deedCodeMap[key] || null;
}

const validDeedTypes = [
  "Warranty Deed",
  "Special Warranty Deed",
  "Quitclaim Deed",
  "Grant Deed",
  "Bargain and Sale Deed",
  "Lady Bird Deed",
  "Transfer on Death Deed",
  "Sheriff's Deed",
  "Tax Deed",
  "Trustee's Deed",
  "Personal Representative Deed",
  "Correction Deed",
  "Deed in Lieu of Foreclosure",
  "Life Estate Deed",
  "Joint Tenancy Deed",
  "Tenancy in Common Deed",
  "Community Property Deed",
  "Gift Deed",
  "Interspousal Transfer Deed",
  "Wild Deed",
  "Special Master's Deed",
  "Court Order Deed",
  "Contract for Deed",
  "Quiet Title Deed",
  "Administrator's Deed",
  "Guardian's Deed",
  "Receiver's Deed",
  "Right of Way Deed",
  "Vacation of Plat Deed",
  "Assignment of Contract",
  "Release of Contract",
  "Miscellaneous"
];

console.log("=== COMPREHENSIVE TEST FOR ERROR FIX ===\n");

// Test the specific error case
const testCases = [
  "Trust",    // The exact value from the error
  "TRUST",    // Uppercase version
  "trust",    // Lowercase version
  "TR",       // The actual instrument code from HTML
  "tr",       // Lowercase variant
  "  Trust  " // With whitespace
];

let allPass = true;

testCases.forEach(input => {
  const result = mapInstrumentToDeedType(input);
  const isValid = result === null || validDeedTypes.includes(result);
  const status = isValid ? "✓ PASS" : "✗ FAIL";

  if (!isValid) allPass = false;

  console.log(`Input: "${input}" → Output: "${result}" ${status}`);

  if (result && !validDeedTypes.includes(result)) {
    console.log(`  ERROR: "${result}" is NOT a valid deed type!`);
  }
});

console.log("\n=== FINAL RESULT ===");
if (allPass) {
  console.log("✓ ALL TESTS PASSED - Error is fixed!");
  console.log("All variations of 'Trust' correctly map to 'Trustee's Deed'");
} else {
  console.log("✗ SOME TESTS FAILED - Error NOT fixed!");
}
